import { PrismaClient } from '@prisma/client';
import { resolveInstallmentDays } from '../src/domain/quotation/recommendation';

const prisma = new PrismaClient();

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function main() {
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      status: 'RECEBIDO',
      paymentTerm: { postReceipt: true },
      installments: { some: { status: { notIn: ['PAGA', 'CANCELADA'] } } },
    },
    include: {
      paymentTerm: true,
      receipts: { orderBy: { receivedAt: 'asc' } },
      installments: { orderBy: { installmentNumber: 'asc' } },
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
    },
  });

  let updated = 0;
  for (const order of orders) {
    const completedReceiptAt = order.receipts.at(-1)?.receivedAt;
    if (!completedReceiptAt) continue;

    const quotationPaymentDays = order.request.approvals[0]?.quotation?.paymentDays ?? 0;
    const days = resolveInstallmentDays(order.paymentTerm.days, quotationPaymentDays);

    for (const installment of order.installments) {
      if (installment.status === 'PAGA' || installment.status === 'CANCELADA') continue;
      const day = days[installment.installmentNumber - 1] ?? days.at(-1) ?? 0;
      const dueDate = addDays(completedReceiptAt, day);
      await prisma.financialInstallment.update({
        where: { id: installment.id },
        data: {
          dueDate,
          status: 'CONFIRMADA',
          notes: 'Vencimento reconciliado a partir do recebimento total e da condição comercial aprovada.',
        },
      });
      updated += 1;
      console.log(`[repair-finance] ${order.code} parcela ${installment.installmentNumber}: ${dueDate.toLocaleDateString('pt-BR')}`);
    }
  }

  console.log(`[repair-finance] concluído: ${updated} parcela(s) reconciliada(s).`);
}

main()
  .catch(error => {
    console.error('[repair-finance] falhou:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
