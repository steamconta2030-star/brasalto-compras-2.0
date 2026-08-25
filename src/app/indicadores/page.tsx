import { Card, Money, PageHeader, Badge } from '../../components/ui';
import { getManagementIndicators, getPriceHistory, getSupplierPerformance } from '../../lib/database';
import { requirePermission } from '../../lib/auth';

function pct(value: number | null) { return value == null ? 'Sem base' : `${value}%`; }
function tone(value: number | null, good=85) { return value == null ? 'neutral' as const : value >= good ? 'good' as const : value >= 65 ? 'warn' as const : 'neutral' as const; }

export default async function Page(){
  await requirePermission('QUOTATION_MANAGE');
  const [metrics, suppliers, prices] = await Promise.all([
    getManagementIndicators(), getSupplierPerformance(), getPriceHistory(),
  ]);
  if (!metrics || !suppliers || !prices) return <div className="page"><PageHeader title="Indicadores" subtitle="Inteligência de compras, preços e fornecedores."/><div className="notice notice-warn">Banco indisponível. Conecte o PostgreSQL para visualizar os indicadores reais.</div></div>;

  return <div className="page">
    <PageHeader title="Indicadores de compras" subtitle="Acompanhe economia, prazo financeiro, entregas e comportamento dos fornecedores."/>

    <div className="kpi-grid kpi-grid-wide">
      <Card><span>Valor total em pedidos</span><strong><Money value={metrics.totalSpent}/></strong><small>{metrics.orderCount} pedido(s) emitido(s)</small></Card>
      <Card><span>Pedidos emitidos no mês</span><strong><Money value={metrics.monthSpent}/></strong><small>Baseado na data de emissão</small></Card>
      <Card><span>Economia vs maior cotação</span><strong><Money value={metrics.savings}/></strong><small>Diferença acumulada entre pedido e maior proposta</small></Card>
      <Card><span>Compras pós-recebimento</span><strong>{metrics.postReceiptRate}%</strong><small>Percentual do valor comprado</small></Card>
      <Card><span>Prazo financeiro médio</span><strong>{metrics.avgPaymentDays} dias</strong><small>Ponderado pelo valor dos pedidos</small></Card>
      <Card><span>Entrega no prazo</span><strong>{pct(metrics.onTimeRate)}</strong><small>Considera pedidos recebidos com previsão</small></Card>
    </div>

    <div className="two-col analytics-grid">
      <Card><div className="section-title"><div><h2>Desempenho dos fornecedores</h2><p>Leitura baseada nos pedidos efetivamente emitidos.</p></div></div>
        {suppliers.length===0 ? <div className="empty-state">Ainda não há pedidos suficientes para avaliar fornecedores.</div> : <div className="table-wrap"><table><thead><tr><th>Fornecedor</th><th>Pedidos</th><th>Comprado</th><th>Ticket médio</th><th>Pós-receb.</th><th>Prazo médio</th><th>Entrega no prazo</th></tr></thead><tbody>{suppliers.slice(0,12).map(s=><tr key={s.name}><td><strong>{s.name}</strong><small className="table-sub">Último: {s.lastOrder.toLocaleDateString('pt-BR')}</small></td><td>{s.orders}</td><td><Money value={s.spent}/></td><td><Money value={s.avgTicket}/></td><td>{s.postReceiptRate}%</td><td>{s.avgPaymentDays} dias</td><td><Badge tone={tone(s.onTimeRate)}>{pct(s.onTimeRate)}</Badge></td></tr>)}</tbody></table></div>}
      </Card>

      <Card><div className="section-title"><div><h2>Pontos de atenção</h2><p>Pendências que merecem ação do time.</p></div></div>
        <div className="attention-list">
          <div><span>Aguardando aprovação</span><strong>{metrics.pendingApprovals}</strong><small>Decisões pendentes</small></div>
          <div><span>Entregas atrasadas</span><strong>{metrics.overdueDeliveries}</strong><small>Pedidos fora da previsão</small></div>
          <div><span>Solicitações abertas</span><strong>{metrics.openRequests}</strong><small>Demandas ainda em ciclo</small></div>
        </div>
      </Card>
    </div>

    <Card className="section-gap"><div className="section-title"><div><h2>Histórico e tendência de preços</h2><p>Últimos 12 meses de itens cotados.</p></div><Badge tone="info">{prices.history.length} registros</Badge></div>
      {prices.trends.length===0 ? <div className="empty-state">O histórico começará a aparecer após o cadastro das primeiras cotações com itens.</div> : <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Último preço</th><th>Menor</th><th>Maior</th><th>Variação</th><th>Amostras</th><th>Último fornecedor</th></tr></thead><tbody>{prices.trends.slice(0,20).map(p=><tr key={`${p.product}-${p.unit}`}><td><strong>{p.product}</strong><small className="table-sub">{p.unit} · {p.latestAt.toLocaleDateString('pt-BR')}</small></td><td><Money value={p.latestPrice}/></td><td><Money value={p.lowestPrice}/></td><td><Money value={p.highestPrice}/></td><td><Badge tone={p.variation<=0?'good':p.variation<=5?'info':'warn'}>{p.variation>0?'+':''}{p.variation.toFixed(1)}%</Badge></td><td>{p.samples}</td><td>{p.latestSupplier}</td></tr>)}</tbody></table></div>}
    </Card>

    <Card className="section-gap"><div className="section-title"><div><h2>Cotações recentes por item</h2><p>Preço unitário, fornecedor e condição de pagamento.</p></div></div>
      {prices.history.length===0 ? <div className="empty-state">Nenhuma cotação com item encontrada.</div> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Solicitação</th><th>Produto</th><th>Fornecedor</th><th>Preço unitário</th><th>Pagamento</th></tr></thead><tbody>{prices.history.slice(0,30).map((p,i)=><tr key={`${p.requestCode}-${p.supplier}-${i}`}><td>{p.quotedAt.toLocaleDateString('pt-BR')}</td><td>{p.requestCode}</td><td><strong>{p.product}</strong><small className="table-sub">{p.unit}</small></td><td>{p.supplier}</td><td><Money value={p.price}/></td><td>{p.payment}</td></tr>)}</tbody></table></div>}
    </Card>
  </div>;
}
