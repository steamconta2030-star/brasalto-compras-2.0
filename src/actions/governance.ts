'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { audit, hashPassword, requirePermission } from '../lib/auth';
import { issueApprovedPurchaseOrder } from './order-flow';

export async function decideApproval(formData: FormData) {
  const actor = await requirePermission('APPROVAL_DECIDE');
  const approvalId = z.string().uuid().parse(formData.get('approvalId'));
  const decision = z.enum(['APROVADA','REPROVADA']).parse(formData.get('decision'));
  const justification = z.string().trim().optional().parse(formData.get('justification') || undefined);
  if (decision === 'REPROVADA' && !justification) throw new Error('Informe o motivo da reprovação.');
  const approval = await prisma.approval.findUniqueOrThrow({ where: { id: approvalId }, include: { request: true } });
  if (approval.status !== 'PENDENTE') throw new Error('Esta aprovação já foi decidida.');
  if (approval.approverId !== actor.id && !actor.permissions.has('ADMIN_ALL')) throw new Error('Esta aprovação está atribuída a outro aprovador.');
  await prisma.$transaction([
    prisma.approval.update({ where: { id: approval.id }, data: { status: decision, decidedAt: new Date(), justification: justification || approval.justification } }),
    prisma.purchaseRequest.update({ where: { id: approval.requestId }, data: { status: decision === 'APROVADA' ? 'APROVADA' : 'REPROVADA' } }),
  ]);
  await audit(actor.id, 'Approval', approval.id, { action: 'DECIDE', decision, justification }, { status: 'PENDENTE' }, approval.request.unitId, 'status');
  if (decision === 'APROVADA') {
    await issueApprovedPurchaseOrder(approval.requestId, actor.id);
  }
  revalidatePath('/'); revalidatePath('/aprovacoes'); revalidatePath('/solicitacoes'); revalidatePath('/pedidos'); revalidatePath('/financeiro');
  redirect(decision === 'APROVADA' ? '/pedidos?created=1&automatic=1' : '/aprovacoes?decided=1');
}

export async function createUser(formData: FormData) {
  const actor = await requirePermission('USER_MANAGE');
  const parsed = z.object({ name: z.string().trim().min(2), email: z.string().email(), password: z.string().min(8), unitId: z.string().uuid().optional().or(z.literal('')), roleId: z.string().uuid() }).parse(Object.fromEntries(formData));
  const user = await prisma.user.create({ data: { name: parsed.name, email: parsed.email.toLowerCase(), passwordHash: hashPassword(parsed.password), unitId: parsed.unitId || null, roles: { create: { roleId: parsed.roleId } } } });
  await audit(actor.id, 'User', user.id, { action: 'CREATE', name: user.name, email: user.email, unitId: user.unitId, roleId: parsed.roleId });
  revalidatePath('/usuarios'); redirect('/usuarios?created=1');
}

export async function toggleUserActive(formData: FormData) {
  const actor = await requirePermission('USER_MANAGE');
  const userId = z.string().uuid().parse(formData.get('userId'));
  if (userId === actor.id) throw new Error('Você não pode desativar o próprio usuário.');
  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const updated = await prisma.user.update({ where: { id: userId }, data: { active: !current.active } });
  if (!updated.active) await prisma.session.deleteMany({ where: { userId } });
  await audit(actor.id, 'User', userId, { active: updated.active }, { active: current.active }, updated.unitId, 'active');
  revalidatePath('/usuarios');
}

export async function createApprovalRule(formData: FormData) {
  const actor = await requirePermission('USER_MANAGE');
  const parsed = z.object({
    name: z.string().trim().min(3), roleId: z.string().uuid(), unitId: z.string().uuid().optional().or(z.literal('')),
    minAmount: z.coerce.number().min(0), maxAmount: z.union([z.coerce.number().positive(), z.literal('')]).optional(),
    priority: z.coerce.number().int().min(1).default(100), requireOnDivergence: z.string().optional(),
  }).parse(Object.fromEntries(formData));
  const maxAmount = parsed.maxAmount === '' || parsed.maxAmount === undefined ? null : parsed.maxAmount;
  if (maxAmount !== null && maxAmount < parsed.minAmount) throw new Error('O valor máximo não pode ser menor que o mínimo.');
  const rule = await prisma.approvalRule.create({ data: {
    name: parsed.name, roleId: parsed.roleId, unitId: parsed.unitId || null, minAmount: parsed.minAmount, maxAmount,
    priority: parsed.priority, requireOnDivergence: parsed.requireOnDivergence === 'on',
  }});
  await audit(actor.id, 'ApprovalRule', rule.id, { action: 'CREATE', name: rule.name, minAmount: Number(rule.minAmount), maxAmount: rule.maxAmount && Number(rule.maxAmount), requireOnDivergence: rule.requireOnDivergence });
  revalidatePath('/alcadas'); redirect('/alcadas?created=1');
}

export async function toggleApprovalRule(formData: FormData) {
  const actor = await requirePermission('USER_MANAGE');
  const id = z.string().uuid().parse(formData.get('ruleId'));
  const current = await prisma.approvalRule.findUniqueOrThrow({ where: { id } });
  const rule = await prisma.approvalRule.update({ where: { id }, data: { active: !current.active } });
  await audit(actor.id, 'ApprovalRule', id, { active: rule.active }, { active: current.active }, rule.unitId, 'active');
  revalidatePath('/alcadas');
}
