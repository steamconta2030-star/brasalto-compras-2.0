import Link from 'next/link';
import { Card, PageHeader, Badge } from '../../components/ui';
import { InventoryTable } from '../../components/inventory-table';
import { getInventoryOverview, getRecentStockMovements } from '../../lib/database';
import { requirePermission } from '../../lib/auth';

function qty(value:number, unit:string){ return `${value.toLocaleString('pt-BR',{maximumFractionDigits:3})} ${unit}`; }
function movementLabel(type:string){ return ({INVENTARIO_INICIAL:'Inventário inicial',ENTRADA:'Entrada',CONSUMO:'Consumo',AJUSTE_ENTRADA:'Ajuste +',AJUSTE_SAIDA:'Ajuste -'} as Record<string,string>)[type] ?? type; }

export default async function Page(){
  const actor = await requirePermission('INVENTORY_MANAGE');
  const [inventory,movements] = await Promise.all([getInventoryOverview(),getRecentStockMovements()]);
  const canRequest = actor.permissions.has('REQUEST_CREATE') || actor.permissions.has('ADMIN_ALL');

  if(!inventory || !movements){
    return <div className="page">
      <PageHeader title="Estoque e uso/consumo" subtitle="Controle preventivo de materiais recorrentes."/>
      <div className="notice notice-warn">Banco indisponível. Conecte o PostgreSQL para controlar o estoque.</div>
    </div>;
  }

  const rows = inventory.rows.map(r=>({
    id:r.id,name:r.name,unit:r.unit,category:r.category,unitOfMeasure:r.unitOfMeasure,
    stock:r.stock,minimum:r.minimum,dailyConsumption:r.dailyConsumption,consumptionSource:r.consumptionSource,
    reorderPoint:r.reorderPoint,coverageDays:r.coverageDays,daysUntilReorder:r.daysUntilReorder,
    suggestedQuantity:r.suggestedQuantity,status:r.status,criticality:r.criticality,
    preferredSupplier:r.preferredSupplier
  }));

  return <div className="page">
    <PageHeader
      title="Estoque e uso/consumo"
      subtitle="Acompanhe saldo, consumo, cobertura e previsão de reposição antes que o material falte."
      action={<div className="header-actions">
        <Link className="button button-secondary" href="/estoque/reposicao">Lista de reposição</Link>
        <Link className="button button-secondary" href="/estoque/cadastro-em-massa">Cadastro em massa</Link>
        <Link className="button button-secondary" href="/estoque/catalogo">Base recorrente</Link>
        <Link className="button button-secondary" href="/estoque/movimento">+ Movimentação</Link>
        <Link className="button" href="/estoque/novo">+ Novo item</Link>
      </div>}
    />

    <div className="kpi-grid kpi-grid-wide">
      <Card><span>Itens controlados</span><strong>{inventory.total}</strong><small>Materiais ativos no inventário</small></Card>
      <Card><span>Críticos</span><strong>{inventory.critical}</strong><small>Saldo no estoque mínimo ou abaixo</small></Card>
      <Card><span>Reposição agora</span><strong>{inventory.replenishNow}</strong><small>Ponto de reposição já atingido</small></Card>
      <Card><span>Atenção em 7 dias</span><strong>{inventory.attention}</strong><small>Próximos do ponto de compra</small></Card>
      <Card><span>Sem base de consumo</span><strong>{inventory.withoutBase}</strong><small>Precisam de estimativa ou histórico confiável</small></Card>
      <Card><span>Regra de previsão</span><strong>7 / 14 dias</strong><small>Histórico entra gradualmente e só assume quando consolidado</small></Card>
    </div>

    <Card>
      <div className="section-title"><div><h2>Previsão de reposição</h2><p>Use a pesquisa e os filtros para encontrar rapidamente o que exige atenção.</p></div></div>
      {rows.length===0?<div className="empty-state">Cadastre o inventário inicial para começar o acompanhamento.</div>:<InventoryTable rows={rows} canRequest={canRequest}/>}
    </Card>

    <Card className="section-gap">
      <div className="section-title"><div><h2>Movimentações recentes</h2><p>Entradas, consumos e ajustes que formam o saldo atual.</p></div><Link href="/estoque/movimento">Registrar movimentação</Link></div>
      {movements.length===0?<div className="empty-state">Ainda não há movimentações registradas.</div>:
      <div className="table-wrap compact-movements"><table><thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th>Quantidade</th><th>Saldo</th><th>Responsável</th><th>Motivo</th></tr></thead>
      <tbody>{movements.map(m=><tr key={m.id}><td>{m.occurredAt.toLocaleString('pt-BR')}</td><td><strong>{m.item}</strong><small className="table-sub">{m.unit}</small></td><td><Badge tone={m.type==='CONSUMO'||m.type==='AJUSTE_SAIDA'?'warn':m.type==='ENTRADA'||m.type==='AJUSTE_ENTRADA'?'good':'info'}>{movementLabel(m.type)}</Badge></td><td>{qty(m.quantity,m.unitOfMeasure)}</td><td>{qty(m.balanceAfter,m.unitOfMeasure)}</td><td>{m.user}</td><td>{m.reason||'—'}</td></tr>)}</tbody></table></div>}
    </Card>
  </div>;
}
