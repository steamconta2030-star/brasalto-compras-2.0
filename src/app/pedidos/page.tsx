import Link from 'next/link';
import { Badge, Card, Money, PageHeader } from '../../components/ui';
import { getApprovedRequestsForOrder, getOrders } from '../../lib/database';
import { orders as demoOrders } from '../../lib/demo-data';
import { statusLabel } from '../../lib/format';
import { requirePermission } from '../../lib/auth';
import { createPurchaseOrder } from '../../actions/order-flow';

export default async function Page() {
  await requirePermission('PURCHASE_ORDER_CREATE');
  const db = await getOrders();
  const pendingApproved = await getApprovedRequestsForOrder();
  const rows = db ?? demoOrders;
  return <div className="page">
    <PageHeader title="Pedidos de compra" subtitle="Acompanhe o pedido aprovado até a entrega na unidade." action={<Link className="button" href="/pedidos/novo">+ Emitir pedido</Link>} />
    {!db && <div className="notice">Modo demonstração: os pedidos reais aparecerão aqui assim que o PostgreSQL estiver conectado.</div>}
    {pendingApproved && pendingApproved.length>0 && <div className="notice notice-warn"><strong>{pendingApproved.length} solicitação(ões) já aprovada(s) aguardam emissão.</strong> Isso inclui aprovações feitas antes da Onda 10.5. {pendingApproved.map(r=><form key={r.id} action={createPurchaseOrder} style={{display:'inline-block',marginLeft:12}}><input type="hidden" name="requestId" value={r.id}/><button className="button button-small" type="submit">Emitir {r.code}</button></form>)}</div>}
    <Card><div className="section-title"><div><h2>Pedidos em acompanhamento</h2><p>Entrega prevista, condição de pagamento e progresso do recebimento.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Solicitação</th><th>Fornecedor</th><th>Unidade</th><th>Total</th><th>Pagamento</th><th>Entrega prevista</th><th>Status</th></tr></thead>
      <tbody>{rows.map((r:any)=><tr key={r.code}><td><strong>{r.code}</strong></td><td><Link className="table-link" href={`/solicitacoes/${r.requestId}`}>{r.request}</Link></td><td>{r.supplier}</td><td>{r.unit}</td><td><Money value={r.total}/></td><td>{r.payment}</td><td>{r.expected instanceof Date?r.expected.toLocaleDateString('pt-BR'):r.expected ?? 'Não informada'}</td><td><Badge tone={String(r.status).includes('RECEBIDO')?'good':'info'}>{statusLabel(r.status)}</Badge></td></tr>)}</tbody></table></div>
    </Card>
  </div>;
}
