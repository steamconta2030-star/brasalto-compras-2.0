import { requirePermission } from '../../../lib/auth';
import Link from 'next/link';
import { createPurchaseOrder } from '../../../actions/order-flow';
import { Card, PageHeader } from '../../../components/ui';
import { getApprovedRequestsForOrder } from '../../../lib/database';

export default async function Page() {
  await requirePermission('PURCHASE_ORDER_CREATE');
  const requests = await getApprovedRequestsForOrder();
  return <div className="page"><PageHeader title="Emitir pedido de compra" subtitle="Transforme uma cotação aprovada em pedido e gere a previsão financeira." />
    {!requests && <div className="notice notice-warn">O banco precisa estar conectado para emitir um pedido real.</div>}
    <Card className="form-card"><form action={createPurchaseOrder} className="form-grid">
      <label className="field field-span"><span>Solicitação aprovada</span><select name="requestId" required disabled={!requests}><option value="">Selecione</option>{requests?.map(r=>{const q=r.approvals[0]?.quotation; return <option key={r.id} value={r.id}>{r.code} · {q?.supplier.tradeName || q?.supplier.legalName} · {q?Number(q.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):''}</option>})}</select></label>
      <label className="field field-span"><span>Observações do pedido</span><textarea name="notes" placeholder="Prazo combinado, referência, instruções para entrega..." /></label>
      <div className="field-span notice">Ao emitir, o sistema cria o pedido, calcula a entrega prevista e gera as parcelas conforme a condição de pagamento aprovada.</div>
      <div className="field-span form-actions"><Link className="button button-secondary" href="/pedidos">Cancelar</Link><button className="button" type="submit" disabled={!requests || requests.length===0}>Emitir pedido</button></div>
    </form></Card>
  </div>;
}
