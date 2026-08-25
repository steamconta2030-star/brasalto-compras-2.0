import { describe, expect, it } from 'vitest';
import { recommendQuotation, resolveInstallmentDays, splitInstallments } from './recommendation';
const pix = { name: 'PIX antecipado', rank: 8, postReceipt: false, paymentDays: 0 };
const boleto30 = { name: 'Boleto 30 dias', rank: 4, postReceipt: true, paymentDays: 30 };
const q = (id:string,total:number,payment:any) => ({id,supplierId:id,supplierName:id,total,payment});
describe('recomendação comercial', () => {
  it('mantém menor preço e recomenda B dentro de 5%', () => { const r = recommendQuotation([q('A',1000,pix),q('B',1030,boleto30)],5); expect(r.menorPreco.id).toBe('A'); expect(r.recomendada?.id).toBe('B'); expect(r.decision).toBe('AUTOMATIC_RECOMMENDATION'); });
  it('não recomenda B quando diferença excede tolerância', () => { const r = recommendQuotation([q('A',1000,pix),q('B',1100,boleto30)],5); expect(r.menorPreco.id).toBe('A'); expect(r.recomendada).toBeUndefined(); expect(r.decision).toBe('BUYER_DECISION_REQUIRED'); });
  it('fecha parcelas com centavos na última', () => { expect(splitInstallments(100,3)).toEqual([33.33,33.33,33.34]); expect(splitInstallments(12000,3).reduce((a,b)=>a+b,0)).toBe(12000); });
});


describe('agenda financeira', () => {
  it('usa dias informados na cotação quando a condição não possui agenda fixa', () => {
    expect(resolveInstallmentDays([], 30)).toEqual([30]);
  });
  it('preserva a agenda fixa de condições parceladas', () => {
    expect(resolveInstallmentDays([30,60,90], 0)).toEqual([30,60,90]);
  });
  it('usa vencimento imediato somente quando não há prazo configurado', () => {
    expect(resolveInstallmentDays([], 0)).toEqual([0]);
  });
});
