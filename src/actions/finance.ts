'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requirePermission } from '../lib/auth';

const idSchema = z.string().uuid();

export async function markInstallmentPaid(formData: FormData) {
  await requirePermission('FINANCE_VIEW');
  const id = idSchema.parse(formData.get('installmentId'));
  const paidAtRaw = String(formData.get('paidAt') || '');
  const paidAt = paidAtRaw ? new Date(`${paidAtRaw}T12:00:00`) : new Date();
  if (Number.isNaN(paidAt.getTime())) throw new Error('Data de pagamento inválida.');

  await prisma.financialInstallment.update({
    where: { id },
    data: { status: 'PAGA', paidAt },
  });
  revalidatePath('/financeiro');
}

export async function reopenInstallment(formData: FormData) {
  await requirePermission('FINANCE_VIEW');
  const id = idSchema.parse(formData.get('installmentId'));
  const installment = await prisma.financialInstallment.findUniqueOrThrow({
    where: { id },
    include: { order: true },
  });
  const now = new Date();
  const status = installment.dueDate < now ? 'VENCIDA' : (installment.order.status === 'RECEBIDO' ? 'CONFIRMADA' : 'PREVISTA');
  await prisma.financialInstallment.update({
    where: { id },
    data: { status, paidAt: null },
  });
  revalidatePath('/financeiro');
}
