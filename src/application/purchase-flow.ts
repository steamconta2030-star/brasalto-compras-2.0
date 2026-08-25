import { recommendQuotation, splitInstallments, type QuotationCandidate } from '../domain/quotation/recommendation';

export type PurchaseFlowPorts = {
  createRequest(input: unknown): Promise<{ id: string; code: string }>;
  saveQuotation(input: unknown): Promise<void>;
  approve(input: { requestId: string; quotationId: string; justification?: string }): Promise<void>;
  createOrder(input: unknown): Promise<{ id: string; code: string }>;
  receive(input: unknown): Promise<void>;
  createInstallments(input: { orderId: string; total: number; count: number; firstDueDate: Date; intervalDays: number }): Promise<void>;
};

export async function completePurchaseFlow(ports: PurchaseFlowPorts, input: {
  request: unknown;
  quotations: QuotationCandidate[];
  tolerancePercent: number;
  selectedQuotationId?: string;
  approvalJustification?: string;
  order: unknown;
  receipt: unknown;
  installment: Omit<Parameters<PurchaseFlowPorts['createInstallments']>[0], 'orderId' | 'total' | 'count'>;
}) {
  const request = await ports.createRequest(input.request);
  for (const quotation of input.quotations) await ports.saveQuotation({ requestId: request.id, quotation });
  const recommendation = recommendQuotation(input.quotations, input.tolerancePercent);
  const selected = input.selectedQuotationId ?? recommendation.recomendada?.id;
  if (!selected) throw new Error('A cotação está fora da tolerância; informe uma escolha e justificativa.');
  if (selected !== recommendation.recomendada?.id && !input.approvalJustification) throw new Error('Justificativa obrigatória para escolher cotação diferente da recomendada.');
  await ports.approve({ requestId: request.id, quotationId: selected, justification: input.approvalJustification });
  const order = await ports.createOrder({ request: input.order, requestId: request.id, quotationId: selected });
  await ports.receive(input.receipt);
  const chosen = input.quotations.find(q => q.id === selected)!;
  await ports.createInstallments({ ...input.installment, orderId: order.id, total: chosen.total, count: chosen.payment.paymentDays > 0 ? Math.max(1, chosen.payment.paymentDays === 90 ? 3 : 1) : 1, });
  return { request, order, recommendation, installments: splitInstallments(chosen.total, chosen.payment.paymentDays === 90 ? 3 : 1) };
}
