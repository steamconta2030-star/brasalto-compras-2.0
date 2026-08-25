export type PaymentOption = {
  name: string;
  rank: number;
  postReceipt: boolean;
  paymentDays: number;
};

export type QuotationCandidate = {
  id: string;
  supplierId: string;
  supplierName: string;
  total: number;
  payment: PaymentOption;
  deliveryDays?: number;
  freight?: number;
};

export type RecommendationResult = {
  menorPreco: QuotationCandidate;
  recomendada?: QuotationCandidate;
  decision: 'AUTOMATIC_RECOMMENDATION' | 'BUYER_DECISION_REQUIRED';
  differenceAmount: number;
  differencePercent: number;
  reason: string;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Returns the lowest price separately from the commercial recommendation.
 * A higher-ranked payment term can win only when its premium is within tolerance.
 * Outside tolerance, the buyer must decide explicitly; no supplier is auto-recommended.
 */
export function recommendQuotation(
  quotations: QuotationCandidate[],
  tolerancePercent: number,
): RecommendationResult {
  if (!quotations.length) throw new Error('É necessário informar ao menos uma cotação.');
  if (tolerancePercent < 0) throw new Error('A tolerância não pode ser negativa.');
  const menorPreco = quotations.reduce((a, b) => a.total <= b.total ? a : b);
  const bestCommercial = quotations.slice().sort((a, b) =>
    a.payment.rank - b.payment.rank || a.total - b.total,
  )[0];
  const differenceAmount = round2(bestCommercial.total - menorPreco.total);
  const differencePercent = menorPreco.total === 0 ? 0 : round2((differenceAmount / menorPreco.total) * 100);
  const withinTolerance = differencePercent <= tolerancePercent;
  const isBetterTerm = bestCommercial.id !== menorPreco.id && bestCommercial.payment.rank < menorPreco.payment.rank;
  const recommended = isBetterTerm && withinTolerance ? bestCommercial : (bestCommercial.id === menorPreco.id ? menorPreco : undefined);
  const reason = recommended
    ? recommended.id === menorPreco.id
      ? 'Menor preço e melhor condição comercial coincidem.'
      : `Valor ${differencePercent.toFixed(2)}% superior ao menor preço, dentro da tolerância de ${tolerancePercent.toFixed(2)}%, com condição de pagamento mais favorável.`
    : `A melhor condição comercial custa ${differencePercent.toFixed(2)}% a mais, acima da tolerância de ${tolerancePercent.toFixed(2)}%. Decisão do comprador necessária.`;
  return { menorPreco, recomendada: recommended, decision: recommended ? 'AUTOMATIC_RECOMMENDATION' : 'BUYER_DECISION_REQUIRED', differenceAmount, differencePercent, reason };
}


export function resolveInstallmentDays(termDays: number[], quotationPaymentDays: number): number[] {
  const normalizedTermDays = termDays
    .filter(day => Number.isInteger(day) && day >= 0);
  if (normalizedTermDays.length) return normalizedTermDays;
  if (Number.isInteger(quotationPaymentDays) && quotationPaymentDays > 0) return [quotationPaymentDays];
  return [0];
}

export function splitInstallments(total: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) throw new Error('Número de parcelas inválido.');
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const result = Array.from({ length: count }, () => base / 100);
  result[count - 1] = (cents - base * (count - 1)) / 100;
  return result;
}
