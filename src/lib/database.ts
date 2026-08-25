import { prisma } from './prisma';
import { decimalToNumber } from './format';
import { calculateInventoryPlan } from '../domain/inventory/planning';

const globalForDatabase = globalThis as unknown as {
  brasautoDbHealth?: { ok: boolean; expiresAt: number };
  brasautoDbHealthPending?: Promise<boolean>;
};


async function timed<T>(label: string, task: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await task();
  } finally {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[perf] ${label}: ${Date.now() - start}ms`);
    }
  }
}

export async function databaseAvailable() {
  if (!process.env.DATABASE_URL) return false;
  const now = Date.now();
  const cached = globalForDatabase.brasautoDbHealth;
  if (cached && cached.expiresAt > now) return cached.ok;
  if (globalForDatabase.brasautoDbHealthPending) return globalForDatabase.brasautoDbHealthPending;

  globalForDatabase.brasautoDbHealthPending = (async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      globalForDatabase.brasautoDbHealth = { ok: true, expiresAt: Date.now() + 60_000 };
      return true;
    } catch {
      globalForDatabase.brasautoDbHealth = { ok: false, expiresAt: Date.now() + 5_000 };
      return false;
    } finally {
      globalForDatabase.brasautoDbHealthPending = undefined;
    }
  })();

  return globalForDatabase.brasautoDbHealthPending;
}

export async function getReferenceData() {
  if (!(await databaseAvailable())) return null;
  const [units, departments, categories, users, suppliers, paymentTerms, requests] = await Promise.all([
    prisma.unit.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: [{ tradeName: 'asc' }, { legalName: 'asc' }] }),
    prisma.paymentTerm.findMany({ where: { active: true }, orderBy: { rank: 'asc' } }),
    prisma.purchaseRequest.findMany({ where: { status: { in: ['AGUARDANDO_COTACAO', 'EM_COTACAO', 'AGUARDANDO_APROVACAO'] } }, orderBy: { requestedAt: 'desc' } }),
  ]);
  return { units, departments, categories, users, suppliers, paymentTerms, requests };
}

export async function getRequests(unitId?: string | null) {
  if (!(await databaseAvailable())) return null;
  const rows = await timed('db:getRequests', () => prisma.purchaseRequest.findMany({
    relationLoadStrategy: 'join',
    where: unitId ? { unitId } : undefined,
    select: {
      id: true, code: true, requestedAt: true, urgency: true, status: true, description: true,
      unit: { select: { name: true } },
      requester: { select: { name: true } },
      items: { select: { product: true }, take: 1 },
    },
    orderBy: { requestedAt: 'desc' },
    take: 100,
  }));
  return rows.map(r => ({
    id: r.id,
    code: r.code,
    date: r.requestedAt,
    unit: r.unit.name,
    item: r.items[0]?.product ?? r.description,
    requester: r.requester.name,
    urgency: r.urgency,
    status: r.status,
  }));
}


export async function getRequestDetail(id: string, unitId?: string | null) {
  if (!(await databaseAvailable())) return null;
  const request = await prisma.purchaseRequest.findUnique({
    relationLoadStrategy: 'join',
    where: { id, ...(unitId ? { unitId } : {}) },
    include: {
      unit: true,
      department: true,
      requester: true,
      category: true,
      items: { include: { inventoryItem: true } },
      quotations: { include: { supplier: true, paymentTerm: true }, orderBy: { quotedAt: 'desc' } },
    },
  });
  if (!request) return null;
  return {
    id: request.id,
    code: request.code,
    requestedAt: request.requestedAt,
    neededBy: request.neededBy,
    unit: request.unit.name,
    department: request.department?.name ?? null,
    requester: request.requester.name,
    category: request.category?.name ?? null,
    urgency: request.urgency,
    description: request.description,
    justification: request.justification,
    notes: request.notes,
    status: request.status,
    items: request.items.map(item => ({
      id: item.id,
      product: item.product,
      detail: item.detail,
      quantity: Number(item.quantity),
      unitOfMeasure: item.unitOfMeasure,
      inventoryItemId: item.inventoryItemId,
      inventoryItemName: item.inventoryItem?.name ?? null,
    })),
    quotations: request.quotations.map(q => ({
      id: q.id,
      supplier: q.supplier.tradeName || q.supplier.legalName,
      total: Number(q.total),
      payment: q.paymentTerm.name,
      quotedAt: q.quotedAt,
    })),
    origin: request.items.some(i => i.inventoryItemId) ? 'ESTOQUE' : 'MANUAL',
  };
}


export async function getPurchaseTrace(requestId: string) {
  if (!(await databaseAvailable())) return null;
  const request = await prisma.purchaseRequest.findUnique({
    relationLoadStrategy: 'join',
    where: { id: requestId },
    include: {
      requester: true,
      quotations: {
        include: { supplier: true, paymentTerm: true },
        orderBy: { quotedAt: 'asc' },
      },
      approvals: {
        include: { approver: true, quotation: { include: { supplier: true } } },
        orderBy: { createdAt: 'asc' },
      },
      orders: {
        include: {
          supplier: true,
          paymentTerm: true,
          receipts: { include: { responsible: true }, orderBy: { receivedAt: 'asc' } },
          installments: { orderBy: { installmentNumber: 'asc' } },
        },
        orderBy: { issuedAt: 'asc' },
      },
    },
  });
  if (!request) return null;

  type TraceEvent = {
    at: Date;
    type: 'SOLICITACAO'|'COTACAO'|'APROVACAO'|'PEDIDO'|'RECEBIMENTO'|'FINANCEIRO';
    title: string;
    description: string;
    actor?: string;
    tone: 'info'|'good'|'warn'|'neutral';
  };
  const events: TraceEvent[] = [{
    at: request.requestedAt,
    type: 'SOLICITACAO',
    title: `${request.code} criada`,
    description: request.description,
    actor: request.requester.name,
    tone: 'info',
  }];

  for (const q of request.quotations) {
    events.push({
      at: q.quotedAt,
      type: 'COTACAO',
      title: `Cotação · ${q.supplier.tradeName || q.supplier.legalName}`,
      description: `${decimalToNumber(q.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · ${q.paymentTerm.name}${q.deliveryDays==null?'':` · entrega ${q.deliveryDays} dia(s)`}`,
      tone: 'neutral',
    });
  }

  for (const a of request.approvals) {
    events.push({
      at: a.decidedAt ?? a.createdAt,
      type: 'APROVACAO',
      title: a.decidedAt ? `Aprovação ${a.status.toLowerCase()}` : 'Enviado para aprovação',
      description: a.quotation
        ? `${a.quotation.supplier.tradeName || a.quotation.supplier.legalName}${a.selectedTotal==null?'':` · ${decimalToNumber(a.selectedTotal).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`}`
        : (a.justification || 'Aguardando decisão'),
      actor: a.approver.name,
      tone: a.status === 'APROVADA' ? 'good' : a.status === 'REPROVADA' ? 'warn' : 'info',
    });
  }

  for (const o of request.orders) {
    events.push({
      at: o.issuedAt,
      type: 'PEDIDO',
      title: `${o.code} emitido`,
      description: `${o.supplier.tradeName || o.supplier.legalName} · ${decimalToNumber(o.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · ${o.paymentTerm.name}`,
      tone: 'info',
    });
    for (const r of o.receipts) {
      events.push({
        at: r.receivedAt,
        type: 'RECEBIMENTO',
        title: `${o.code} · recebimento registrado`,
        description: r.damaged || r.discrepancies ? `Recebido com ressalva${r.discrepancies?`: ${r.discrepancies}`:''}` : 'Recebimento sem ressalvas',
        actor: r.responsible.name,
        tone: r.damaged || r.discrepancies ? 'warn' : 'good',
      });
    }
    for (const f of o.installments) {
      if (f.paidAt) {
        events.push({
          at: f.paidAt,
          type: 'FINANCEIRO',
          title: `${o.code} · parcela ${f.installmentNumber} paga`,
          description: `${decimalToNumber(f.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · vencimento ${f.dueDate.toLocaleDateString('pt-BR')}`,
          tone: 'good',
        });
      }
    }
  }
  return events.sort((a,b)=>a.at.getTime()-b.at.getTime());
}

export async function getSuppliers() {
  if (!(await databaseAvailable())) return null;
  const rows = await prisma.supplier.findMany({
    relationLoadStrategy: 'join',
    include: { defaultPaymentTerm: true, categories: { include: { category: true } } },
    orderBy: [{ tradeName: 'asc' }, { legalName: 'asc' }],
  });
  return rows.map(s => ({
    name: s.tradeName || s.legalName,
    city: [s.city, s.state].filter(Boolean).join('/') || 'Não informado',
    category: s.categories.map(c => c.category.name).join(', ') || 'Sem categoria',
    payment: s.defaultPaymentTerm?.name || 'Não definida',
    document: s.document,
    active: s.active,
  }));
}

export async function getQuotationComparison(requestId?: string) {
  if (!(await databaseAvailable())) return null;
  const request = await prisma.purchaseRequest.findFirst({
    relationLoadStrategy: 'join',
    where: requestId ? { id: requestId, quotations: { some: {} } } : { quotations: { some: {} } },
    orderBy: { requestedAt: 'desc' },
    include: {
      quotations: { include: { supplier: true, paymentTerm: true }, orderBy: { total: 'asc' } },
    },
  });
  if (!request) return null;
  return {
    code: request.code,
    requestId: request.id,
    quotations: request.quotations.map(q => ({
      id: q.id,
      supplierId: q.supplierId,
      supplierName: q.supplier.tradeName || q.supplier.legalName,
      total: decimalToNumber(q.total),
      payment: {
        name: q.paymentTerm.name,
        rank: q.paymentTerm.rank,
        postReceipt: q.paymentTerm.postReceipt,
        paymentDays: q.paymentDays,
      },
      deliveryDays: q.deliveryDays,
    })),
  };
}

export async function getApprovedRequestsForOrder() {
  if (!(await databaseAvailable())) return null;
  return prisma.purchaseRequest.findMany({
    where: { status: 'APROVADA', orders: { none: {} } },
    include: {
      unit: true,
      approvals: { where: { status: 'APROVADA' }, orderBy: { decidedAt: 'desc' }, take: 1, include: { quotation: { include: { supplier: true, paymentTerm: true } } } },
    },
    orderBy: { requestedAt: 'asc' },
  });
}

export async function getOrders() {
  if (!(await databaseAvailable())) return null;
  const rows = await timed('db:getOrders', () => prisma.purchaseOrder.findMany({
    relationLoadStrategy: 'join',
    select: {
      id: true, code: true, requestId: true, total: true, expectedDelivery: true, status: true,
      request: { select: { code: true } },
      supplier: { select: { tradeName: true, legalName: true } },
      unit: { select: { name: true } },
      paymentTerm: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          receiptItems: { select: { quantity: true } },
        },
      },
    },
    orderBy: { code: 'desc' },
    take: 100,
  }));
  return rows.map(order => ({
    id: order.id,
    code: order.code,
    request: order.request.code,
    requestId: order.requestId,
    supplier: order.supplier.tradeName || order.supplier.legalName,
    unit: order.unit.name,
    total: decimalToNumber(order.total),
    payment: order.paymentTerm.name,
    expected: order.expectedDelivery,
    status: order.status,
    progress: order.items.length ? Math.round(order.items.reduce((sum, item) => {
      const received = item.receiptItems.reduce((s, ri) => s + Number(ri.quantity), 0);
      return sum + Math.min(1, received / Number(item.quantity));
    }, 0) / order.items.length * 100) : 0,
  }));
}

export async function getReceiptReferenceData() {
  if (!(await databaseAvailable())) return null;
  const [orders, users] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { status: { in: ['AGUARDANDO_ENTREGA', 'RECEBIDO_PARCIALMENTE'] } },
      include: { supplier: true, items: { include: { receiptItems: true } } },
      orderBy: { expectedDelivery: 'asc' },
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);
  return { orders, users };
}

export async function getReceipts() {
  if (!(await databaseAvailable())) return null;
  const rows = await prisma.receipt.findMany({
    include: { order: true, responsible: true, items: { include: { orderItem: { include: { requestItem: true } } } } },
    orderBy: { receivedAt: 'desc' },
  });
  return rows.map(r => ({
    id: r.id,
    order: r.order.code,
    item: r.items.map(i => i.orderItem.product).join(', '),
    received: r.items.map(i => `${Number(i.quantity).toLocaleString('pt-BR')} ${i.orderItem.requestItem?.unitOfMeasure ?? 'UN'}`).join(' · '),
    date: r.receivedAt,
    responsible: r.responsible.name,
    status: r.damaged || r.discrepancies ? 'COM RESSALVA' : 'RECEBIDO',
  }));
}

export async function getInstallments() {
  if (!(await databaseAvailable())) return null;
  const rows = await timed('db:getInstallments', () => prisma.financialInstallment.findMany({
    relationLoadStrategy: 'join',
    select: {
      id: true, installmentNumber: true, amount: true, dueDate: true, status: true, paidAt: true, notes: true,
      order: { select: { code: true } },
      supplier: { select: { tradeName: true, legalName: true } },
      paymentTerm: { select: { days: true, postReceipt: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 200,
  }));
  return rows.map(i => ({
    id: i.id,
    order: i.order.code,
    supplier: i.supplier.tradeName || i.supplier.legalName,
    installment: `${i.installmentNumber}/${i.paymentTerm.days.length || 1}`,
    amount: decimalToNumber(i.amount),
    due: i.dueDate,
    status: i.status,
    postReceipt: i.paymentTerm.postReceipt,
    paidAt: i.paidAt,
    notes: i.notes,
  }));
}

export async function getManagementIndicators() {
  if (!(await databaseAvailable())) return null;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [requests, approvals, orders] = await timed('db:getManagementIndicators', () => Promise.all([
    prisma.purchaseRequest.findMany({
      select: { status: true },
      take: 500,
    }),
    prisma.approval.count({ where: { status: 'PENDENTE' } }),
    prisma.purchaseOrder.findMany({
      relationLoadStrategy: 'join',
      where: { status: { not: 'CANCELADO' } },
      select: {
        total: true, issuedAt: true, expectedDelivery: true, status: true,
        paymentTerm: { select: { days: true, postReceipt: true } },
        receipts: { select: { receivedAt: true } },
        request: { select: { quotations: { select: { total: true } } } },
      },
      take: 500,
    }),
  ]));

  const totalSpent = orders.reduce((sum, o) => sum + decimalToNumber(o.total), 0);
  const monthSpent = orders.filter(o => o.issuedAt >= monthStart).reduce((sum, o) => sum + decimalToNumber(o.total), 0);
  const openRequests = requests.filter(r => !['FINALIZADA', 'CANCELADA', 'REPROVADA'].includes(r.status)).length;
  const overdueDeliveries = orders.filter(o => o.expectedDelivery && o.expectedDelivery < now && !['RECEBIDO', 'CANCELADO'].includes(o.status)).length;

  let savings = 0;
  for (const order of orders) {
    const totals = order.request.quotations.map(q => decimalToNumber(q.total));
    if (totals.length >= 2) savings += Math.max(0, Math.max(...totals) - decimalToNumber(order.total));
  }

  const completedWithDeadline = orders.filter(o => o.status === 'RECEBIDO' && o.expectedDelivery && o.receipts.length);
  const onTime = completedWithDeadline.filter(o => {
    const finalReceipt = new Date(Math.max(...o.receipts.map(r => r.receivedAt.getTime())));
    return finalReceipt <= o.expectedDelivery!;
  }).length;
  const onTimeRate = completedWithDeadline.length ? Math.round((onTime / completedWithDeadline.length) * 100) : null;

  const weighted = orders.reduce((acc, o) => {
    const value = decimalToNumber(o.total);
    const horizon = o.paymentTerm.days.length ? Math.max(...o.paymentTerm.days) : 0;
    return { amount: acc.amount + value, days: acc.days + value * horizon };
  }, { amount: 0, days: 0 });
  const avgPaymentDays = weighted.amount ? Math.round(weighted.days / weighted.amount) : 0;
  const postReceiptValue = orders.filter(o => o.paymentTerm.postReceipt).reduce((sum, o) => sum + decimalToNumber(o.total), 0);
  const postReceiptRate = totalSpent ? Math.round((postReceiptValue / totalSpent) * 100) : 0;

  return {
    totalSpent,
    monthSpent,
    savings,
    openRequests,
    pendingApprovals: approvals,
    overdueDeliveries,
    onTimeRate,
    avgPaymentDays,
    postReceiptRate,
    orderCount: orders.length,
  };
}

export async function getSupplierPerformance() {
  if (!(await databaseAvailable())) return null;
  const orders = await prisma.purchaseOrder.findMany({
    where: { status: { not: 'CANCELADO' } },
    include: {
      supplier: true,
      paymentTerm: true,
      receipts: { select: { receivedAt: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  const grouped = new Map<string, {
    name: string; orders: number; spent: number; lastOrder: Date; postReceipt: number;
    paymentDaysWeighted: number; deliveryEligible: number; onTime: number;
  }>();
  for (const o of orders) {
    const value = decimalToNumber(o.total);
    const current = grouped.get(o.supplierId) ?? {
      name: o.supplier.tradeName || o.supplier.legalName,
      orders: 0, spent: 0, lastOrder: o.issuedAt, postReceipt: 0,
      paymentDaysWeighted: 0, deliveryEligible: 0, onTime: 0,
    };
    current.orders += 1;
    current.spent += value;
    if (o.issuedAt > current.lastOrder) current.lastOrder = o.issuedAt;
    if (o.paymentTerm.postReceipt) current.postReceipt += 1;
    const horizon = o.paymentTerm.days.length ? Math.max(...o.paymentTerm.days) : 0;
    current.paymentDaysWeighted += horizon * value;
    if (o.status === 'RECEBIDO' && o.expectedDelivery && o.receipts.length) {
      current.deliveryEligible += 1;
      const finalReceipt = new Date(Math.max(...o.receipts.map(r => r.receivedAt.getTime())));
      if (finalReceipt <= o.expectedDelivery) current.onTime += 1;
    }
    grouped.set(o.supplierId, current);
  }

  return [...grouped.values()].map(s => ({
    name: s.name,
    orders: s.orders,
    spent: s.spent,
    avgTicket: s.orders ? s.spent / s.orders : 0,
    avgPaymentDays: s.spent ? Math.round(s.paymentDaysWeighted / s.spent) : 0,
    postReceiptRate: s.orders ? Math.round((s.postReceipt / s.orders) * 100) : 0,
    onTimeRate: s.deliveryEligible ? Math.round((s.onTime / s.deliveryEligible) * 100) : null,
    lastOrder: s.lastOrder,
  })).sort((a,b) => b.spent - a.spent);
}

export async function getPriceHistory() {
  if (!(await databaseAvailable())) return null;
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const rows = await prisma.quotationItem.findMany({
    where: { quotation: { quotedAt: { gte: since } } },
    include: {
      requestItem: true,
      quotation: { include: { supplier: true, paymentTerm: true, request: true } },
    },
    orderBy: { quotation: { quotedAt: 'desc' } },
    take: 300,
  });

  const history = rows.map(r => ({
    product: r.requestItem.product,
    unit: r.requestItem.unitOfMeasure,
    price: decimalToNumber(r.unitPrice),
    supplier: r.quotation.supplier.tradeName || r.quotation.supplier.legalName,
    payment: r.quotation.paymentTerm.name,
    quotedAt: r.quotation.quotedAt,
    requestCode: r.quotation.request.code,
  }));

  const groups = new Map<string, typeof history>();
  for (const row of history) {
    const key = `${row.product.trim().toLocaleLowerCase('pt-BR')}|${row.unit}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const trends = [...groups.values()].map(list => {
    const sorted = [...list].sort((a,b) => a.quotedAt.getTime() - b.quotedAt.getTime());
    const oldest = sorted[0];
    const latest = sorted[sorted.length - 1];
    const prices = sorted.map(x => x.price);
    const variation = oldest.price ? ((latest.price - oldest.price) / oldest.price) * 100 : 0;
    return {
      product: latest.product,
      unit: latest.unit,
      latestPrice: latest.price,
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      variation,
      samples: sorted.length,
      latestSupplier: latest.supplier,
      latestAt: latest.quotedAt,
    };
  }).sort((a,b) => b.samples - a.samples || a.product.localeCompare(b.product, 'pt-BR'));

  return { trends, history: history.slice(0, 80) };
}

export async function getInventoryReferenceData() {
  if (!(await databaseAvailable())) return null;
  const [units, categories, items, suppliers] = await Promise.all([
    prisma.unit.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.inventoryItem.findMany({ where: { active: true }, include: { unit: true }, orderBy: [{ unit: { name: 'asc' } }, { name: 'asc' }] }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: [{ tradeName: 'asc' }, { legalName: 'asc' }] }),
  ]);
  return { units, categories, items, suppliers };
}

export async function getInventoryOverview() {
  if (!(await databaseAvailable())) return null;
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const items = await timed('db:getInventoryOverview', () => prisma.inventoryItem.findMany({
    relationLoadStrategy: 'join',
    where: { active: true },
    select: {
      id: true, name: true, description: true, unitId: true, unitOfMeasure: true,
      currentStock: true, minimumStock: true, targetStock: true, estimatedDailyConsumption: true,
      leadTimeDays: true, safetyDays: true, criticality: true, replenishmentMethod: true,
      unit: { select: { name: true } },
      category: { select: { name: true } },
      preferredSupplier: { select: { tradeName: true, legalName: true } },
      movements: {
        where: { occurredAt: { gte: since }, type: 'CONSUMO' },
        select: { quantity: true, occurredAt: true },
        orderBy: { occurredAt: 'asc' },
      },
    },
    orderBy: [{ unit: { name: 'asc' } }, { name: 'asc' }],
    take: 300,
  }));

  const now = new Date();
  const rows = items.map(item => {
    const stock = decimalToNumber(item.currentStock);
    const minimum = decimalToNumber(item.minimumStock);
    const estimated = item.estimatedDailyConsumption == null ? null : decimalToNumber(item.estimatedDailyConsumption);
    const plan = calculateInventoryPlan({
      currentStock: stock,
      minimumStock: minimum,
      targetStock: item.targetStock == null ? null : decimalToNumber(item.targetStock),
      estimatedDailyConsumption: estimated,
      leadTimeDays: item.leadTimeDays,
      safetyDays: item.safetyDays,
      consumptions: item.movements.map(m => ({ quantity: decimalToNumber(m.quantity), occurredAt: m.occurredAt })),
      now,
    });
    return {
      id: item.id, name: item.name, description: item.description, unit: item.unit.name, unitId: item.unitId,
      category: item.category?.name ?? 'Sem categoria', unitOfMeasure: item.unitOfMeasure, stock, minimum,
      criticality: item.criticality, replenishmentMethod: item.replenishmentMethod,
      preferredSupplier: item.preferredSupplier?.tradeName ?? item.preferredSupplier?.legalName ?? null,
      target: plan.target, dailyConsumption: plan.dailyConsumption, consumptionSource: plan.consumptionSource,
      leadTimeDays: item.leadTimeDays, safetyDays: item.safetyDays, reorderPoint: plan.reorderPoint,
      coverageDays: plan.coverageDays, daysUntilReorder: plan.daysUntilReorder, nextPurchaseDate: plan.nextPurchaseDate,
      suggestedQuantity: plan.suggestedQuantity, status: plan.status,
    };
  });
  const severity = { CRITICO: 0, REPOR_AGORA: 1, ATENCAO: 2, SEM_BASE: 3, OK: 4 } as const;
  rows.sort((a,b) => severity[a.status] - severity[b.status] || a.name.localeCompare(b.name, 'pt-BR'));
  const critical = rows.filter(r => r.status === 'CRITICO').length;
  const replenishNow = rows.filter(r => r.status === 'REPOR_AGORA').length;
  const attention = rows.filter(r => r.status === 'ATENCAO').length;
  const withoutBase = rows.filter(r => r.status === 'SEM_BASE').length;
  return { rows, critical, replenishNow, attention, withoutBase, total: rows.length };
}

export async function getRecentStockMovements() {
  if (!(await databaseAvailable())) return null;
  const rows = await timed('db:getRecentStockMovements', () => prisma.stockMovement.findMany({
    relationLoadStrategy: 'join',
    select: {
      id: true, type: true, quantity: true, balanceAfter: true, reason: true, occurredAt: true,
      inventoryItem: { select: { name: true, unitOfMeasure: true, unit: { select: { name: true } } } },
      user: { select: { name: true } },
    },
    orderBy: { occurredAt: 'desc' },
    take: 40,
  }));
  return rows.map(m => ({
    id: m.id,
    item: m.inventoryItem.name,
    unit: m.inventoryItem.unit.name,
    unitOfMeasure: m.inventoryItem.unitOfMeasure,
    type: m.type,
    quantity: decimalToNumber(m.quantity),
    balanceAfter: decimalToNumber(m.balanceAfter),
    reason: m.reason,
    occurredAt: m.occurredAt,
    user: m.user.name,
  }));
}
