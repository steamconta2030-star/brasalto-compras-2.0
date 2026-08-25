import type { Prisma } from '@prisma/client';

export async function lockTransaction(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

export function nextDocumentCode(prefix: 'SC' | 'PC', year: number, lastCode?: string | null) {
  const lastNumber = lastCode ? Number(lastCode.split('-').at(-1)) || 0 : 0;
  return `${prefix}-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
}
