import Link from 'next/link';
import { Badge, Card, Money, PageHeader } from '../components/ui';
import { requests as demoRequests, orders as demoOrders } from '../lib/demo-data';
import { getInstallments, getInventoryOverview, getManagementIndicators, getOrders, getRequests } from '../lib/database';
import { statusLabel } from '../lib/format';
import { requireUser } from '../lib/auth';

export default async function Dashboard(){
  const actor = await requireUser();
  const admin = actor.permissions.has('ADMIN_ALL');
  const canManagePurchases = admin || actor.permissions.has('QUOTATION_MANAGE') || actor.permissions.has('PURCHASE_ORDER_CREATE');
  const canSeeFinance = admin || actor.permissions.has('FINANCE_VIEW');
  const canSeeInventory = admin || actor.permissions.has('INVENTORY_MANAGE');
  const unitScope = admin ? null : actor.unitId;
  const [dbRows,dbOrders,metrics,inventory,installments]=await Promise.all([
    getRequests(unitScope),
    canManagePurchases ? getOrders() : Promise.resolve([]),
    canManagePurchases ? getManagementIndicators() : Promise.resolve(null),
    canSeeInventory ? getInventoryOverview() : Promise.resolve(null),
    canSeeFinance ? getInstallments() : Promise.resolve([]),
  ]);
  const rows=(dbRows ?? demoRequests).slice(0,5);
  const orders=dbOrders ?? demoOrders;
  const open=metrics?.openRequests ?? (dbRows?.filter((r:any)=>!['FINALIZADA','CANCELADA','REPROVADA'].includes(r.status)).length ?? 0);
  const approvals=metrics?.pendingApprovals ?? 0;
  const deliveryOrders=orders.filter((r:any)=>['AGUARDANDO_ENTREGA','RECEBIDO_PARCIALMENTE'].includes(r.status));
  const inDelivery=deliveryOrders.length;
  const stockCritical=inventory ? inventory.critical+inventory.replenishNow : 0;
  const now=new Date();
  const openFinancial=(installments??[]).filter((r:any)=>!['PAGA','CANCELADA'].includes(String(r.status)));
  const dueValue=openFinancial.reduce((s:number,r:any)=>s+Number(r.amount),0);
  const overdueValue=openFinancial.filter((r:any)=>new Date(r.due)<now).reduce((s:number,r:any)=>s+Number(r.amount),0);
  const actionCount=approvals+inDelivery+stockCritical+(overdueValue>0?1:0);

  return <div className="page">
    <PageHeader title="Dashboard gerencial" subtitle="Prioridades de Compras, estoque, entregas e compromissos financeiros em uma única visão." action={<Link className="button" href="/solicitacoes/nova">+ Nova solicitação</Link>}/>
    {!dbRows && <div className="notice">Painel em demonstração. Ao conectar o banco, os indicadores passam a refletir os registros reais.</div>}

    <div className="kpi-grid dashboard-kpis">
      <Card className="dashboard-kpi dashboard-kpi-blue">
        <div className="dashboard-kpi-top"><span>Solicitações em andamento</span><span className="dashboard-kpi-icon">SC</span></div>
        <strong>{open}</strong>
        <small>{open ? 'Demandas acompanhadas pelo Compras' : 'Nenhuma solicitação em aberto'}</small>
      </Card>
      <Card className={`dashboard-kpi ${approvals ? 'dashboard-kpi-amber' : 'dashboard-kpi-green'}`}>
        <div className="dashboard-kpi-top"><span>Aprovações pendentes</span><span className="dashboard-kpi-icon">AP</span></div>
        <strong>{approvals}</strong>
        <small>{approvals ? 'Exigem decisão da alçada responsável' : 'Nenhuma decisão pendente'}</small>
      </Card>
      <Card className={`dashboard-kpi ${(metrics?.overdueDeliveries ?? 0) ? 'dashboard-kpi-amber' : 'dashboard-kpi-blue'}`}>
        <div className="dashboard-kpi-top"><span>Aguardando entrega</span><span className="dashboard-kpi-icon">PC</span></div>
        <strong>{inDelivery}</strong>
        <small>{(metrics?.overdueDeliveries ?? 0) ? `${metrics?.overdueDeliveries ?? 0} entrega(s) atrasada(s)` : 'Pedidos dentro do acompanhamento'}</small>
      </Card>
      <Card className={`dashboard-kpi ${stockCritical ? 'dashboard-kpi-amber' : 'dashboard-kpi-green'}`}>
        <div className="dashboard-kpi-top"><span>Estoque crítico</span><span className="dashboard-kpi-icon">ES</span></div>
        <strong>{stockCritical}</strong>
        <small>{stockCritical ? `${stockCritical} item(ns) exigem reposição imediata` : inventory?.attention ? `${inventory.attention} item(ns) em atenção` : 'Sem alerta de estoque'}</small>
      </Card>
    </div>

    <div className="management-strip dashboard-financial-strip">
      <div className="dashboard-financial-card"><span>Valor emitido no mês</span><strong>{metrics?<Money value={metrics.monthSpent}/>: '—'}</strong><small>Pedidos emitidos no período</small></div>
      <div className="dashboard-financial-card dashboard-financial-positive"><span>Economia acumulada</span><strong>{metrics?<Money value={metrics.savings}/>: '—'}</strong><small>Diferença entre propostas comparadas</small></div>
      <div className="dashboard-financial-card"><span>Compromissos em aberto</span><strong><Money value={dueValue}/></strong><small>Valores ainda não baixados</small></div>
      <div className={`dashboard-financial-card ${overdueValue>0?'dashboard-financial-alert':''}`}><span>Vencido</span><strong><Money value={overdueValue}/></strong><small>{overdueValue>0?'Exige atenção financeira':'Nenhum compromisso vencido'}</small></div>
    </div>

    <div className="two-col">
      <Card>
        <div className="section-title"><div><h2>Central de atenção</h2><p>O que precisa de acompanhamento agora.</p></div><Badge tone={actionCount?'warn':'good'}>{actionCount ? `${actionCount} ponto(s)` : 'EM DIA'}</Badge></div>
        <div className="roadmap">
          <div><strong>Aprovações</strong><span>{approvals ? `${approvals} decisão(ões) aguardando ação` : 'Nenhuma pendência'}</span><Link href="/aprovacoes">Abrir</Link></div>
          <div><strong>Entregas</strong><span>{inDelivery ? `${inDelivery} pedido(s) em acompanhamento` : 'Nenhum pedido aguardando entrega'}</span><Link href="/pedidos">Abrir</Link></div>
          <div><strong>Estoque</strong><span>{stockCritical ? `${stockCritical} item(ns) para reposição imediata` : 'Sem reposição crítica'}</span><Link href="/estoque">Abrir</Link></div>
          <div><strong>Financeiro</strong><span>{overdueValue ? 'Existem compromissos vencidos' : `${openFinancial.length} compromisso(s) aberto(s)`}</span><Link href="/financeiro">Abrir</Link></div>
        </div>
      </Card>

      <Card>
        <div className="section-title"><div><h2>Eficiência comercial</h2><p>Indicadores das decisões de compra.</p></div><Link href="/indicadores">Detalhes</Link></div>
        <div className="efficiency-list">
          <div className="efficiency-row"><strong>Prazo financeiro médio</strong><div className="efficiency-value"><span>{metrics ? `${metrics.avgPaymentDays} dias` : '—'}</span><Badge tone="info">PAGAMENTO</Badge></div></div>
          <div className="efficiency-row"><strong>Pós-recebimento</strong><div className="efficiency-value"><span>{metrics ? `${metrics.postReceiptRate}% do valor comprado` : '—'}</span><Badge tone="good">CAIXA</Badge></div></div>
          <div className="efficiency-row"><strong>Entrega no prazo</strong><div className="efficiency-value"><span>{metrics?.onTimeRate == null ? 'Sem base suficiente' : `${metrics.onTimeRate}%`}</span><Badge tone="info">FORNECEDORES</Badge></div></div>
          <div className="efficiency-row"><strong>Pedidos emitidos</strong><div className="efficiency-value"><span>{metrics ? `${metrics.orderCount} pedido(s)` : orders.length}</span><Badge>HISTÓRICO</Badge></div></div>
        </div>
      </Card>
    </div>

    <Card>
      <div className="section-title"><div><h2>Solicitações recentes</h2><p>Últimos movimentos do processo de compras.</p></div><Link href="/solicitacoes">Ver todas</Link></div>
      <div className="table-wrap"><table><thead><tr><th>Código</th><th>Unidade</th><th>Item</th><th>Urgência</th><th>Status</th></tr></thead>
      <tbody>{rows.map((r:any)=><tr key={r.code}><td><strong>{r.code}</strong></td><td>{r.unit}</td><td>{r.item}</td><td><Badge tone={r.urgency==='ALTA'?'warn':'info'}>{r.urgency}</Badge></td><td><Badge tone={String(r.status).includes('APROVACAO')?'warn':'info'}>{statusLabel(r.status)}</Badge></td></tr>)}</tbody></table></div>
    </Card>
  </div>;
}
