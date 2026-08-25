import Link from 'next/link';
import { PageHeader, Card, Badge } from '../../../components/ui';
import { requirePermission } from '../../../lib/auth';
import { getInventoryOverview } from '../../../lib/database';
function qty(v:number,u:string){return `${v.toLocaleString('pt-BR',{maximumFractionDigits:3})} ${u}`;}
export default async function Page(){
  await requirePermission('INVENTORY_MANAGE');
  const inventory=await getInventoryOverview();
  if(!inventory) return <div className="page"><PageHeader title="Lista de reposição" subtitle="Materiais que exigem ação de compra."/><div className="notice notice-warn">Banco indisponível.</div></div>;
  const rows=inventory.rows.filter(r=>['CRITICO','REPOR_AGORA','ATENCAO'].includes(r.status));
  return <div className="page">
    <PageHeader title="Lista de reposição" subtitle="Visão consolidada dos materiais que merecem atenção de compra." action={<Link className="button button-secondary" href="/estoque">Voltar</Link>}/>
    <div className="kpi-grid">
      <Card><span>Itens na lista</span><strong>{rows.length}</strong><small>Críticos, repor agora ou atenção</small></Card>
      <Card><span>Repor agora</span><strong>{rows.filter(r=>r.status==='REPOR_AGORA'||r.status==='CRITICO').length}</strong><small>Ação imediata</small></Card>
      <Card><span>Atenção</span><strong>{rows.filter(r=>r.status==='ATENCAO').length}</strong><small>Próximos do ponto de compra</small></Card>
    </div>
    <Card className="section-gap">
      {rows.length===0?<div className="empty-state">Nenhum material precisa de reposição neste momento.</div>:
      <div className="table-wrap"><table><thead><tr><th>Status</th><th>Item</th><th>Unidade</th><th>Saldo</th><th>Consumo/dia</th><th>Comprar</th><th>Sugestão</th><th>Fornecedor</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.id}><td><Badge tone={r.status==='ATENCAO'?'info':'warn'}>{r.status==='ATENCAO'?'ATENÇÃO':'REPOR'}</Badge></td><td><strong>{r.name}</strong><small className="table-sub">{r.category}</small></td><td>{r.unit}</td><td>{qty(r.stock,r.unitOfMeasure)}</td><td>{r.dailyConsumption?qty(r.dailyConsumption,r.unitOfMeasure):'—'}</td><td>{r.nextPurchaseDate?r.nextPurchaseDate.toLocaleDateString('pt-BR'):'Agora'}</td><td>{r.suggestedQuantity?qty(r.suggestedQuantity,r.unitOfMeasure):'—'}</td><td>{r.preferredSupplier??'Não definido'}</td></tr>)}</tbody></table></div>}
    </Card>
  </div>;
}
