'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { recommendQuotation } from '../domain/quotation/recommendation';
import { audit, requirePermission } from '../lib/auth';

const nonEmpty = z.string().trim().min(1);
const optionalUuid = z.string().uuid().optional().or(z.literal(''));

async function nextRequestCode() {
  const year = new Date().getFullYear();
  const last = await prisma.purchaseRequest.findFirst({ where: { year }, orderBy: { code: 'desc' }, select: { code: true } });
  const lastNumber = last ? Number(last.code.split('-').at(-1)) || 0 : 0;
  return `SC-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
}

export async function createPurchaseRequest(formData: FormData) {
  const actor = await requirePermission('REQUEST_CREATE');
  const parsed = z.object({
    unitId: z.string().uuid(),
    departmentId: optionalUuid,
    requesterId: z.string().uuid().optional().or(z.literal('')),
    categoryId: optionalUuid,
    urgency: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']),
    description: nonEmpty,
    justification: z.string().trim().optional(),
    product: nonEmpty,
    detail: z.string().trim().optional(),
    quantity: z.coerce.number().positive(),
    unitOfMeasure: nonEmpty,
  }).parse(Object.fromEntries(formData));
  if (actor.unitId && parsed.unitId !== actor.unitId && !actor.permissions.has('ADMIN_ALL')) throw new Error('Seu perfil não pode abrir solicitação para outra unidade.');

  const code = await nextRequestCode();
  const created = await prisma.purchaseRequest.create({
    data: {
      code,
      year: new Date().getFullYear(),
      unitId: parsed.unitId,
      departmentId: parsed.departmentId || null,
      requesterId: actor.id,
      categoryId: parsed.categoryId || null,
      urgency: parsed.urgency,
      description: parsed.description,
      justification: parsed.justification || null,
      status: 'AGUARDANDO_COTACAO',
      items: { create: { product: parsed.product, detail: parsed.detail || null, quantity: parsed.quantity, unitOfMeasure: parsed.unitOfMeasure } },
    },
  });
  await audit(actor.id, 'PurchaseRequest', created.id, { action: 'CREATE', code: created.code, status: created.status }, undefined, created.unitId);
  revalidatePath('/');
  revalidatePath('/solicitacoes');
  redirect('/solicitacoes?created=1');
}

export async function createSupplier(formData: FormData) {
  const actor = await requirePermission('SUPPLIER_MANAGE');
  const parsed = z.object({
    legalName: nonEmpty,
    tradeName: z.string().trim().optional(),
    document: nonEmpty,
    stateRegistration: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    whatsapp: z.string().trim().optional(),
    email: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().max(2).optional(),
    salesperson: z.string().trim().optional(),
    defaultPaymentTermId: optionalUuid,
    categoryId: optionalUuid,
    unitId: optionalUuid,
    notes: z.string().trim().optional(),
  }).parse(Object.fromEntries(formData));

  const created = await prisma.supplier.create({
    data: {
      legalName: parsed.legalName,
      tradeName: parsed.tradeName || null,
      document: parsed.document,
      stateRegistration: parsed.stateRegistration || null,
      phone: parsed.phone || null,
      whatsapp: parsed.whatsapp || null,
      email: parsed.email || null,
      city: parsed.city || null,
      state: parsed.state?.toUpperCase() || null,
      salesperson: parsed.salesperson || null,
      defaultPaymentTermId: parsed.defaultPaymentTermId || null,
      notes: parsed.notes || null,
      categories: parsed.categoryId ? { create: { categoryId: parsed.categoryId } } : undefined,
      units: parsed.unitId ? { create: { unitId: parsed.unitId } } : undefined,
    },
  });
  await audit(actor.id, 'Supplier', created.id, { action: 'CREATE', document: created.document, legalName: created.legalName });
  revalidatePath('/fornecedores');
  redirect('/fornecedores?created=1');
}

export async function createQuotation(formData: FormData) {
  const actor = await requirePermission('QUOTATION_MANAGE');
  const parsed = z.object({
    requestId: z.string().uuid(),
    supplierId: z.string().uuid(),
    paymentTermId: z.string().uuid(),
    total: z.coerce.number().positive(),
    discount: z.coerce.number().min(0).default(0),
    freight: z.coerce.number().min(0).default(0),
    deliveryDays: z.preprocess(
      value => value === '' || value == null ? undefined : value,
      z.coerce.number().int().min(0).optional(),
    ),
    paymentDays: z.coerce.number().int().min(0).default(0),
    notes: z.string().trim().optional(),
  }).parse(Object.fromEntries(formData));

  // As três leituras abaixo são independentes; executá-las em paralelo reduz a latência
  // perceptível quando o PostgreSQL está remoto.
  const duplicateWindow = new Date(Date.now() - 60_000);
  const [term, request, recentDuplicate] = await Promise.all([
    prisma.paymentTerm.findUniqueOrThrow({ where: { id: parsed.paymentTermId } }),
    prisma.purchaseRequest.findUniqueOrThrow({ where: { id: parsed.requestId }, include: { items: true } }),
    prisma.quotation.findFirst({
      where: {
        requestId: parsed.requestId,
        supplierId: parsed.supplierId,
        paymentTermId: parsed.paymentTermId,
        total: parsed.total,
        discount: parsed.discount,
        freight: parsed.freight,
        paymentDays: parsed.paymentDays,
        deliveryDays: parsed.deliveryDays ?? null,
        quotedAt: { gte: duplicateWindow },
      },
      orderBy: { quotedAt: 'desc' },
      select: { id: true },
    }),
  ]);
  if (recentDuplicate) {
    revalidatePath('/cotacoes');
    revalidatePath('/solicitacoes');
    revalidatePath(`/solicitacoes/${parsed.requestId}`);
    redirect(`/solicitacoes/${parsed.requestId}?quotation=duplicate-blocked`);
  }

  const firstItem = request.items[0];
  if (!firstItem) throw new Error('A solicitação precisa ter ao menos um item.');

  const [quotation] = await prisma.$transaction([
    prisma.quotation.create({
      data: {
        requestId: parsed.requestId,
        supplierId: parsed.supplierId,
        paymentTermId: parsed.paymentTermId,
        total: parsed.total,
        discount: parsed.discount,
        freight: parsed.freight,
        deliveryDays: parsed.deliveryDays ?? null,
        paymentDays: parsed.paymentDays || Math.max(...term.days, 0),
        paidAfterReceipt: term.postReceipt,
        notes: parsed.notes || null,
        items: { create: { requestItemId: firstItem.id, quantity: firstItem.quantity, unitPrice: parsed.total / Number(firstItem.quantity), subtotal: parsed.total } },
      },
    }),
    prisma.purchaseRequest.update({ where: { id: parsed.requestId }, data: { status: 'EM_COTACAO' } }),
  ]);
  await audit(actor.id, 'Quotation', quotation.id, { action: 'CREATE', requestId: parsed.requestId, supplierId: parsed.supplierId, total: parsed.total }, undefined, request.unitId);
  revalidatePath('/cotacoes');
  revalidatePath('/solicitacoes');
  revalidatePath(`/solicitacoes/${parsed.requestId}`);
  redirect(`/solicitacoes/${parsed.requestId}?quotation=created`);
}

export async function deleteQuotation(formData: FormData) {
  const actor = await requirePermission('QUOTATION_MANAGE');
  const quotationId = z.string().uuid().parse(formData.get('quotationId'));
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: {
      request: true,
      approvals: { select: { id: true } },
    },
  });

  const editableRequestStatuses = ['AGUARDANDO_COTACAO', 'EM_COTACAO'];
  if (quotation.approvals.length > 0 || !editableRequestStatuses.includes(quotation.request.status)) {
    throw new Error('As cotações ficam bloqueadas após o encerramento da fase de cotação para preservar o histórico da compra.');
  }

  await prisma.$transaction(async tx => {
    await tx.quotation.delete({ where: { id: quotationId } });
    const remaining = await tx.quotation.count({ where: { requestId: quotation.requestId } });
    if (remaining === 0) {
      await tx.purchaseRequest.update({
        where: { id: quotation.requestId },
        data: { status: 'AGUARDANDO_COTACAO' },
      });
    }
  });

  await audit(
    actor.id,
    'Quotation',
    quotation.id,
    { action: 'DELETE', requestId: quotation.requestId, supplierId: quotation.supplierId, total: Number(quotation.total) },
    undefined,
    quotation.request.unitId,
  );
  revalidatePath('/cotacoes');
  revalidatePath('/solicitacoes');
  revalidatePath(`/solicitacoes/${quotation.requestId}`);
  redirect(`/solicitacoes/${quotation.requestId}?quotation=deleted`);
}

export async function approveRecommendedQuotation(formData: FormData) {
  const actor = await requirePermission('QUOTATION_MANAGE');
  const requestId = z.string().uuid().parse(formData.get('requestId'));
  const quotationId = z.string().uuid().parse(formData.get('quotationId'));
  const justification = z.string().trim().optional().parse(formData.get('justification') || undefined);

  const request = await prisma.purchaseRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { quotations: { include: { supplier: true, paymentTerm: true } } },
  });
  const candidates = request.quotations.map(q => ({
    id: q.id, supplierId: q.supplierId, supplierName: q.supplier.tradeName || q.supplier.legalName, total: Number(q.total),
    payment: { name: q.paymentTerm.name, rank: q.paymentTerm.rank, postReceipt: q.paymentTerm.postReceipt, paymentDays: q.paymentDays },
  }));
  const recommendation = recommendQuotation(candidates, 5);
  const divergent = quotationId !== recommendation.recomendada?.id;
  if (divergent && !justification) throw new Error('Justificativa obrigatória para escolha diferente da recomendação do sistema.');
  const chosen = request.quotations.find(q => q.id === quotationId);
  if (!chosen) throw new Error('Cotação não pertence à solicitação.');

  const amount = Number(chosen.total);
  const rules = await prisma.approvalRule.findMany({
    where: { active: true, OR: [{ unitId: request.unitId }, { unitId: null }] },
    include: { role: true }, orderBy: [{ priority: 'asc' }, { minAmount: 'desc' }],
  });
  const eligible = rules.filter(rule => amount >= Number(rule.minAmount) && (rule.maxAmount == null || amount <= Number(rule.maxAmount)));
  const rule = (divergent ? eligible.find(r => r.requireOnDivergence) : null) ?? eligible.find(r => !r.requireOnDivergence) ?? eligible[0];
  if (!rule) throw new Error('Nenhuma alçada de aprovação foi configurada para este valor.');
  const approver = await prisma.user.findFirst({
    where: {
      active: true,
      roles: { some: { roleId: rule.roleId } },
      ...(rule.unitId ? { OR: [{ unitId: rule.unitId }, { unitId: null }] } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!approver) throw new Error(`Nenhum usuário ativo possui o perfil exigido pela alçada: ${rule.role.name}.`);

  const approval = await prisma.$transaction(async tx => {
    await tx.approval.deleteMany({ where: { requestId, status: 'PENDENTE' } });
    const created = await tx.approval.create({ data: {
      requestId, quotationId, approverId: approver.id, ruleId: rule.id, status: 'PENDENTE',
      selectedSupplierId: chosen.supplierId, selectedTotal: chosen.total,
      justification: justification || recommendation.reason,
      systemRecommendedQuotationId: recommendation.recomendada?.id || null,
    }});
    await tx.purchaseRequest.update({ where: { id: requestId }, data: { status: 'AGUARDANDO_APROVACAO' } });
    return created;
  });
  await audit(actor.id, 'Approval', approval.id, { action: 'SUBMIT', requestId, quotationId, approverId: approver.id, rule: rule.name, divergent, amount }, undefined, request.unitId);
  revalidatePath('/'); revalidatePath('/cotacoes'); revalidatePath('/solicitacoes'); revalidatePath('/aprovacoes');
  redirect(`/aprovacoes?requestId=${requestId}&created=1`);
}
