import { requirePermission } from '../../../lib/auth';
import Link from 'next/link';
import { registerReceipt } from '../../../actions/order-flow';
import { Card, PageHeader } from '../../../components/ui';
import { getReceiptReferenceData } from '../../../lib/database';

export default async function Page() {
  const actor = await requirePermission('RECEIPT_REGISTER');
  const data = await getReceiptReferenceData();
  const itemOptions = data?.orders.flatMap(order => order.items.map(item => {
    const received = item.receiptItems.reduce((sum, ri)=>sum+Number(ri.quantity),0);
    const pending = Number(item.quantity)-received;
    return { orderId:order.id, orderItemId:item.id, label:`${order.code} · ${order.supplier.tradeName||order.supplier.legalName} · ${item.product} · saldo ${pending.toLocaleString('pt-BR')}`, pending };
  })).filter(i=>i.pending>0) ?? [];
  return <div className="page"><PageHeader title="Registrar recebimento" subtitle="O saldo do pedido é validado para impedir recebimento acima da quantidade comprada." />
  {!data && <div className="notice notice-warn">O banco precisa estar conectado para registrar um recebimento real.</div>}
  <Card className="form-card"><form action={registerReceipt} className="form-grid">
    <label className="field field-span"><span>Pedido e item</span><select name="orderItemId" required disabled={!data}><option value="">Selecione</option>{itemOptions.map(i=><option key={i.orderItemId} value={i.orderItemId}>{i.label}</option>)}</select></label>
    <label className="field"><span>Responsável pelo recebimento</span><select name="responsibleId" required disabled={!data} defaultValue={actor.id}><option value="">Selecione</option>{data?.users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
    <label className="field"><span>Quantidade recebida</span><input name="quantity" type="number" min="0.001" step="0.001" required /></label>
    <label className="field"><span>Data do recebimento</span><input name="receivedAt" type="date" /></label>
    <label className="field field-span"><span>Observações</span><textarea name="notes" /></label>
    <label className="field field-span"><span>Divergências / avarias</span><textarea name="discrepancies" placeholder="Descreva falta, avaria, item incorreto ou outra ressalva." /></label>
    <label className="check-field field-span"><input name="damaged" type="checkbox" /> Houve avaria na entrega</label>
    <div className="field-span form-actions"><Link className="button button-secondary" href="/recebimentos">Cancelar</Link><button className="button" type="submit" disabled={!data || itemOptions.length===0}>Registrar recebimento</button></div>
  </form></Card></div>;
}
