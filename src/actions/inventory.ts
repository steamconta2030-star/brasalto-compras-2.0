'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { audit, requirePermission } from '../lib/auth';
import { calculateInventoryPlan } from '../domain/inventory/planning';

const optionalUuid = z.string().uuid().optional().or(z.literal(''));
const nonEmpty = z.string().trim().min(1);
const optionalPositiveNumber = z.preprocess(v => v === '' || v == null ? undefined : v, z.coerce.number().positive().optional());

async function nextRequestCode() {
  const year = new Date().getFullYear();
  const last = await prisma.purchaseRequest.findFirst({ where: { year }, orderBy: { code: 'desc' }, select: { code: true } });
  const lastNumber = last ? Number(last.code.split('-').at(-1)) || 0 : 0;
  return `SC-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
}

export async function createInventoryItem(formData: FormData) {
  const actor = await requirePermission('INVENTORY_MANAGE');
  const parsed = z.object({
    unitId: z.string().uuid(),
    categoryId: optionalUuid,
    name: nonEmpty,
    description: z.string().trim().optional(),
    unitOfMeasure: nonEmpty,
    initialStock: z.coerce.number().min(0),
    minimumStock: z.coerce.number().min(0),
    targetStock: optionalPositiveNumber,
    estimatedDailyConsumption: optionalPositiveNumber,
    leadTimeDays: z.coerce.number().int().min(0).max(365),
    safetyDays: z.coerce.number().int().min(0).max(365),
    criticality: z.enum(['NORMAL','IMPORTANTE','CRITICO']).default('NORMAL'),
    replenishmentMethod: z.enum(['CONSUMO_MEDIO','ESTOQUE_MINIMO']).default('CONSUMO_MEDIO'),
    preferredSupplierId: optionalUuid,
    notes: z.string().trim().optional(),
  }).parse(Object.fromEntries(formData));

  if (actor.unitId && actor.unitId !== parsed.unitId && !actor.permissions.has('ADMIN_ALL')) {
    throw new Error('Seu perfil não pode cadastrar estoque para outra unidade.');
  }
  if (parsed.targetStock != null && parsed.targetStock < parsed.minimumStock) {
    throw new Error('O estoque alvo não pode ser menor que o estoque mínimo.');
  }

  const created = await prisma.$transaction(async tx => {
    const item = await tx.inventoryItem.create({
      data: {
        unitId: parsed.unitId,
        categoryId: parsed.categoryId || null,
        name: parsed.name,
        description: parsed.description || null,
        unitOfMeasure: parsed.unitOfMeasure.toUpperCase(),
        currentStock: parsed.initialStock,
        minimumStock: parsed.minimumStock,
        targetStock: parsed.targetStock ?? null,
        estimatedDailyConsumption: parsed.estimatedDailyConsumption ?? null,
        leadTimeDays: parsed.leadTimeDays,
        safetyDays: parsed.safetyDays,
        criticality: parsed.criticality,
        replenishmentMethod: parsed.replenishmentMethod,
        preferredSupplierId: parsed.preferredSupplierId || null,
        notes: parsed.notes || null,
      },
    });
    if (parsed.initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          userId: actor.id,
          type: 'INVENTARIO_INICIAL',
          quantity: parsed.initialStock,
          balanceAfter: parsed.initialStock,
          reason: 'Inventário inicial',
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        unitId: parsed.unitId,
        entity: 'InventoryItem',
        recordId: item.id,
        newValue: {
          action: 'CREATE',
          name: item.name,
          initialStock: parsed.initialStock,
          minimumStock: parsed.minimumStock,
        },
      },
    });
    return item;
  });
  revalidatePath('/');
  revalidatePath('/estoque');
  redirect('/estoque?created=1');
}

export async function registerStockMovement(formData: FormData) {
  const actor = await requirePermission('INVENTORY_MANAGE');
  const parsed = z.object({
    inventoryItemId: z.string().uuid(),
    type: z.enum(['ENTRADA','CONSUMO','AJUSTE_ENTRADA','AJUSTE_SAIDA']),
    quantity: z.coerce.number().positive(),
    reason: z.string().trim().optional(),
  }).parse(Object.fromEntries(formData));

  const result = await prisma.$transaction(async tx => {
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: parsed.inventoryItemId } });
    if (actor.unitId && actor.unitId !== item.unitId && !actor.permissions.has('ADMIN_ALL')) {
      throw new Error('Seu perfil não pode movimentar estoque de outra unidade.');
    }
    const isOut = parsed.type === 'CONSUMO' || parsed.type === 'AJUSTE_SAIDA';
    const current = Number(item.currentStock);
    const next = current + (isOut ? -parsed.quantity : parsed.quantity);
    if (next < 0) throw new Error(`Saldo insuficiente. Estoque atual: ${current.toLocaleString('pt-BR')} ${item.unitOfMeasure}.`);

    const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { currentStock: next } });
    const movement = await tx.stockMovement.create({
      data: {
        inventoryItemId: item.id,
        userId: actor.id,
        type: parsed.type,
        quantity: parsed.quantity,
        balanceAfter: next,
        reason: parsed.reason || null,
      },
    });
    return { item: updated, movement, previous: current, next };
  });

  await audit(actor.id, 'InventoryItem', result.item.id, {
    action: 'STOCK_MOVEMENT', type: parsed.type, quantity: parsed.quantity, balanceAfter: result.next,
  }, { balanceBefore: result.previous }, result.item.unitId);
  revalidatePath('/');
  revalidatePath('/estoque');
  revalidatePath('/estoque/movimento');
  redirect('/estoque?movement=1');
}

export async function createReplenishmentRequest(formData: FormData) {
  const actor = await requirePermission('REQUEST_CREATE');
  const itemId = z.string().uuid().parse(formData.get('inventoryItemId'));
  const year = new Date().getFullYear();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [item, lastRequest] = await Promise.all([
    prisma.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
      include: {
        stockMovements: {
          where: { occurredAt: { gte: since }, type: 'CONSUMO' },
          orderBy: { occurredAt: 'asc' },
        },
      },
    }),
    prisma.purchaseRequest.findFirst({
      where: { year },
      orderBy: { code: 'desc' },
      select: { code: true },
    }),
  ]);

  if (actor.unitId && actor.unitId !== item.unitId && !actor.permissions.has('ADMIN_ALL')) {
    throw new Error('Seu perfil não pode abrir solicitação para outra unidade.');
  }

  const current = Number(item.currentStock);
  const plan = calculateInventoryPlan({
    currentStock: current,
    minimumStock: Number(item.minimumStock),
    targetStock: item.targetStock == null ? null : Number(item.targetStock),
    estimatedDailyConsumption: item.estimatedDailyConsumption == null ? null : Number(item.estimatedDailyConsumption),
    leadTimeDays: item.leadTimeDays,
    safetyDays: item.safetyDays,
    consumptions: item.stockMovements.map(m=>({quantity:Number(m.quantity),occurredAt:m.occurredAt})),
  });
  const quantity = plan.suggestedQuantity;
  if (quantity <= 0) throw new Error('Este item não possui quantidade de reposição pendente.');

  const lastNumber = lastRequest ? Number(lastRequest.code.split('-').at(-1)) || 0 : 0;
  const code = `SC-${year}-${String(lastNumber + 1).padStart(4, '0')}`;

  const request = await prisma.$transaction(async tx => {
    const created = await tx.purchaseRequest.create({
      data: {
        code,
        year,
        unitId: item.unitId,
        requesterId: actor.id,
        categoryId: item.categoryId,
        urgency: current <= Number(item.minimumStock) ? 'ALTA' : 'MEDIA',
        description: `Reposição de estoque: ${item.name}`,
        justification: `Reposição gerada pelo controle de uso e consumo. Saldo atual: ${current.toLocaleString('pt-BR')} ${item.unitOfMeasure}.`,
        status: 'AGUARDANDO_COTACAO',
        items: { create: { product: item.name, detail: item.description, quantity, unitOfMeasure: item.unitOfMeasure, inventoryItemId: item.id } },
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        unitId: item.unitId,
        entity: 'PurchaseRequest',
        recordId: created.id,
        newValue: { action: 'CREATE_FROM_INVENTORY', inventoryItemId: item.id, code, quantity },
      },
    });
    return created;
  });

  revalidatePath('/');
  revalidatePath('/estoque');
  revalidatePath('/solicitacoes');
  redirect(`/solicitacoes?created=inventory&id=${request.id}`);
}

export async function createBulkInventoryItems(formData: FormData) {
  const actor = await requirePermission('INVENTORY_MANAGE');
  const parsed = z.object({
    unitId: z.string().uuid(),
    minimumStock: z.coerce.number().min(0).default(1),
    leadTimeDays: z.coerce.number().int().min(0).max(365).default(7),
    safetyDays: z.coerce.number().int().min(0).max(365).default(3),
  }).parse(Object.fromEntries(formData));
  const rawItems = formData.getAll('items').map(String).filter(Boolean);
  if (rawItems.length === 0) throw new Error('Selecione pelo menos um material.');
  if (actor.unitId && actor.unitId !== parsed.unitId && !actor.permissions.has('ADMIN_ALL')) {
    throw new Error('Seu perfil não pode cadastrar estoque para outra unidade.');
  }
  const items = rawItems.map(raw => {
    const [name, unitOfMeasure, criticality] = raw.split('|');
    return { name, unitOfMeasure, criticality: criticality as 'NORMAL'|'IMPORTANTE'|'CRITICO' };
  });
  const existing = await prisma.inventoryItem.findMany({
    where: { unitId: parsed.unitId, name: { in: items.map(i=>i.name) } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map(i=>i.name));
  const toCreate = items.filter(i=>!existingNames.has(i.name));
  if (toCreate.length > 0) {
    await prisma.inventoryItem.createMany({
      data: toCreate.map(i=>({
        unitId: parsed.unitId,
        name: i.name,
        unitOfMeasure: i.unitOfMeasure,
        currentStock: 0,
        minimumStock: parsed.minimumStock,
        leadTimeDays: parsed.leadTimeDays,
        safetyDays: parsed.safetyDays,
        criticality: i.criticality,
        replenishmentMethod: 'CONSUMO_MEDIO',
      })),
      skipDuplicates: true,
    });
  }
  await audit(actor.id, 'InventoryItem', parsed.unitId, {
    action: 'BULK_CREATE',
    requested: items.length,
    created: toCreate.length,
    skipped: existing.length,
  }, undefined, parsed.unitId);
  revalidatePath('/');
  revalidatePath('/estoque');
  redirect(`/estoque?bulk=${toCreate.length}`);
}
