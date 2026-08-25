'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolveInstallmentDays, splitInstallments } from '../domain/quotation/recommendation';
import { audit, requirePermission } from '../lib/auth';

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function nextOrderCode() {
  const year = new Date().getFullYear();
  const last = await prisma.purchaseOrder.findFirst({ where: { year }, orderBy: { code: 'desc' }, select: { code: true } });
  const lastNumber = last ? Number(last.code.split('-').at(-1)) || 0 : 0;
  return `PC-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
}

export async function issueApprovedPurchaseOrder(requestId: string, actorId: string, notes?: string) {
  const existing = await prisma.purchaseOrder.findFirst({ where: { requestId } });
  if (existing) return existing;

  const request = await prisma.purchaseRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      unit: true,
      items: true,
      approvals: {
        where: { status: 'APROVADA', quotationId: { not: null } },
        orderBy: { decidedAt: 'desc' },
        take: 1,
        include: { quotation: { include: { paymentTerm: true, items: true } } },
      },
    },
  });
  const approval = request.approvals[0];
  const quotation = approval?.quotation;
  if (!quotation) throw new Error('A solicitação precisa ter uma cotação aprovada antes da emissão do pedido.');

  const code = await nextOrderCode();
  const now = new Date();
  const expectedDelivery = quotation.deliveryDays == null ? null : addDays(now, quotation.deliveryDays);
  const days = resolveInstallmentDays(quotation.paymentTerm.days, quotation.paymentDays);
  const amounts = splitInstallments(Number(quotation.total), days.length);
  const baseDate = quotation.paymentTerm.postReceipt ? (expectedDelivery ?? now) : now;

  const createdOrder = await prisma.$transaction(async tx => {
    const order = await tx.purchaseOrder.create({
      data: {
        code, year: now.getFullYear(), requestId: request.id, supplierId: quotation.supplierId,
        unitId: request.unitId, paymentTermId: quotation.paymentTermId, total: quotation.total,
        deliveryDays: quotation.deliveryDays, expectedDelivery, status: 'AGUARDANDO_ENTREGA',
        responsibleId: actorId, notes: notes || 'Pedido emitido automaticamente após aprovação.',
        items: {
          create: quotation.items.map(qi => {
            const requestItem = request.items.find(i => i.id === qi.requestItemId);
            return {
              requestItemId: qi.requestItemId,
              product: requestItem?.product ?? 'Item da solicitação',
              quantity: qi.quantity, unitPrice: qi.unitPrice, subtotal: qi.subtotal,
            };
          }),
        },
      },
    });
    await tx.financialInstallment.createMany({
      data: days.map((day, index) => ({
        orderId: order.id, supplierId: quotation.supplierId, unitId: request.unitId,
        paymentTermId: quotation.paymentTermId, installmentNumber: index + 1,
        amount: amounts[index], dueDate: addDays(baseDate, day), status: 'PREVISTA',
        notes: quotation.paymentTerm.postReceipt ? 'Vencimento provisório; será recalculado após recebimento total.' : null,
      })),
    });
    await tx.purchaseRequest.update({ where: { id: request.id }, data: { status: 'AGUARDANDO_ENTREGA' } });
    return order;
  });
  await audit(actorId, 'PurchaseOrder', createdOrder.id, { action: 'CREATE_AUTO_AFTER_APPROVAL', code: createdOrder.code, total: Number(createdOrder.total), requestId: request.id }, undefined, request.unitId);
  return createdOrder;
}

export async function createPurchaseOrder(formData: FormData) {
  const actor = await requirePermission('PURCHASE_ORDER_CREATE');
  const requestId = z.string().uuid().parse(formData.get('requestId'));
  const notes = z.string().trim().optional().parse(formData.get('notes') || undefined);
  await issueApprovedPurchaseOrder(requestId, actor.id, notes);
  revalidatePath('/'); revalidatePath('/solicitacoes'); revalidatePath('/pedidos'); revalidatePath('/financeiro');
  redirect('/pedidos?created=1');
}

export async function registerReceipt(formData: FormData) {
  const actor = await requirePermission('RECEIPT_REGISTER');
  const parsed = z.object({
    orderItemId: z.string().uuid(),
    responsibleId: z.string().uuid(),
    quantity: z.coerce.number().positive(),
    receivedAt: z.string().optional(),
    notes: z.string().trim().optional(),
    discrepancies: z.string().trim().optional(),
    damaged: z.string().optional(),
  }).parse(Object.fromEntries(formData));

  const selectedItem = await prisma.purchaseOrderItem.findUniqueOrThrow({
    where: { id: parsed.orderItemId },
    select: { orderId: true },
  });
  const order = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: selectedItem.orderId },
    include: {
      paymentTerm: true,
      request: {
        include: {
          approvals: {
            where: { status: 'APROVADA', quotationId: { not: null } },
            orderBy: { decidedAt: 'desc' },
            take: 1,
            include: { quotation: true },
          },
        },
      },
      items: { include: { receiptItems: true, requestItem: true } },
    },
  });
  const target = order.items.find(i => i.id === parsed.orderItemId);
  if (!target) throw new Error('O item selecionado não pertence ao pedido.');
  const alreadyReceived = target.receiptItems.reduce((sum, item) => sum + Number(item.quantity), 0);
  const pending = Number(target.quantity) - alreadyReceived;
  if (parsed.quantity > pending + 0.0001) throw new Error(`Quantidade informada excede o saldo pendente de ${pending}.`);
  const receivedAt = parsed.receivedAt ? new Date(`${parsed.receivedAt}T12:00:00`) : new Date();

  const receipt = await prisma.$transaction(async tx => {
    const createdReceipt = await tx.receipt.create({
      data: {
        orderId: order.id,
        unitId: order.unitId,
        responsibleId: parsed.responsibleId,
        receivedAt,
        notes: parsed.notes || null,
        discrepancies: parsed.discrepancies || null,
        damaged: parsed.damaged === 'on',
        items: { create: { orderItemId: target.id, quantity: parsed.quantity } },
      },
    });

    // Onda 10: pedidos originados pelo estoque voltam automaticamente ao inventário
    // quando o recebimento é registrado. Compras manuais permanecem sem vínculo.
    if (target.requestItem?.inventoryItemId && parsed.damaged !== 'on') {
      const inventoryItem = await tx.inventoryItem.findUnique({
        where: { id: target.requestItem.inventoryItemId },
      });
      if (inventoryItem && inventoryItem.unitId === order.unitId) {
        const previousStock = Number(inventoryItem.currentStock);
        const nextStock = previousStock + parsed.quantity;
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { currentStock: nextStock },
        });
        await tx.stockMovement.create({
          data: {
            inventoryItemId: inventoryItem.id,
            userId: parsed.responsibleId,
            type: 'ENTRADA',
            quantity: parsed.quantity,
            balanceAfter: nextStock,
            reason: `Entrada automática pelo recebimento do pedido ${order.code}`,
            occurredAt: receivedAt,
          },
        });
      }
    }

    const refreshedItems = await tx.purchaseOrderItem.findMany({
      where: { orderId: order.id },
      include: { receiptItems: true },
    });
    const full = refreshedItems.every(item => {
      const received = item.receiptItems.reduce((sum, ri) => sum + Number(ri.quantity), 0);
      return received + 0.0001 >= Number(item.quantity);
    });
    const any = refreshedItems.some(item => item.receiptItems.length > 0);
    const orderStatus = full ? 'RECEBIDO' : any ? 'RECEBIDO_PARCIALMENTE' : 'AGUARDANDO_ENTREGA';
    const requestStatus = full ? 'RECEBIDA' : any ? 'RECEBIDA_PARCIALMENTE' : 'AGUARDANDO_ENTREGA';
    await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: orderStatus } });
    await tx.purchaseRequest.update({ where: { id: order.requestId }, data: { status: requestStatus } });

    if (full && order.paymentTerm.postReceipt) {
      const approvedQuotationPaymentDays = order.request.approvals[0]?.quotation?.paymentDays ?? 0;
      const days = resolveInstallmentDays(order.paymentTerm.days, approvedQuotationPaymentDays);
      const installments = await tx.financialInstallment.findMany({ where: { orderId: order.id }, orderBy: { installmentNumber: 'asc' } });
      for (const installment of installments) {
        const day = days[installment.installmentNumber - 1] ?? days.at(-1) ?? 0;
        await tx.financialInstallment.update({
          where: { id: installment.id },
          data: { dueDate: addDays(receivedAt, day), status: 'CONFIRMADA', notes: 'Vencimento confirmado a partir do recebimento total.' },
        });
      }
    }
    return createdReceipt;
  });
  await audit(actor.id, 'Receipt', receipt.id, { action: 'CREATE', orderId: order.id, quantity: parsed.quantity, damaged: parsed.damaged === 'on', discrepancies: parsed.discrepancies || null }, undefined, order.unitId);

  revalidatePath('/');
  revalidatePath('/pedidos');
  revalidatePath('/recebimentos');
  revalidatePath('/financeiro');
  revalidatePath('/estoque');
  redirect('/recebimentos?received=1');
}
