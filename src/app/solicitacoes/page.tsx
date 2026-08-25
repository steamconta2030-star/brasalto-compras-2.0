import Link from 'next/link';
import { Badge, Card, PageHeader } from '../../components/ui';
import { requests as demoRequests } from '../../lib/demo-data';
import { getRequests } from '../../lib/database';
import { brDate, statusLabel } from '../../lib/format';
import { requireUser } from '../../lib/auth';

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;unit?:string;status?:string}>}){
  const actor = await requireUser();
  const filters = await searchParams;
  const dbRows = await getRequests(actor.permissions.has('ADMIN_ALL') ? null : actor.unitId);
  const allRows = dbRows ?? demoRequests.map(r => ({...r, date: r.date, urgency: r.urgency.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''), status:r.status}));
  const query=(filters.q??'').trim().toLocaleLowerCase('pt-BR');
  const units=Array.from(new Set(allRows.map(r=>r.unit))).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const rows=allRows.filter(r=>(!query||`${r.code} ${r.item} ${r.requester}`.toLocaleLowerCase('pt-BR').includes(query))&&(!filters.unit||r.unit===filters.unit)&&(!filters.status||r.status===filters.status));
  return <div className="page">
    <PageHeader title="Solicitações de compra" subtitle="Registre a demanda antes da cotação e acompanhe cada etapa do processo." action={<Link className="button" href="/solicitacoes/nova">+ Nova solicitação</Link>}/>
    {!dbRows && <div className="notice">Modo demonstração: configure <strong>DATABASE_URL</strong> e execute as migrações/seed para ativar persistência PostgreSQL.</div>}
    <Card><form className="toolbar" method="get"><input name="q" defaultValue={filters.q} placeholder="Buscar código, item ou solicitante..."/><select name="unit" defaultValue={filters.unit}><option value="">Todas as unidades</option>{units.map(unit=><option key={unit} value={unit}>{unit}</option>)}</select><select name="status" defaultValue={filters.status}><option value="">Todos os status</option><option value="EM_COTACAO">Em cotação</option><option value="AGUARDANDO_APROVACAO">Aguardando aprovação</option><option value="APROVADA">Aprovada</option><option value="AGUARDANDO_ENTREGA">Aguardando entrega</option></select><button className="button button-small" type="submit">Filtrar</button></form>
    <div className="table-wrap"><table><thead><tr><th>Código</th><th>Data</th><th>Unidade</th><th>Descrição</th><th>Solicitante</th><th>Urgência</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rows.map(r=><tr key={r.code}><td><strong>{r.code}</strong></td><td>{typeof r.date === 'string' ? r.date : brDate(r.date)}</td><td>{r.unit}</td><td>{r.item}</td><td>{r.requester}</td><td><Badge tone={String(r.urgency).includes('ALTA')||String(r.urgency).includes('URGENTE')?'warn':'neutral'}>{statusLabel(String(r.urgency))}</Badge></td><td><Badge tone="info">{statusLabel(r.status)}</Badge></td><td>{'id' in r && r.id?<Link className="button button-small button-secondary" href={`/solicitacoes/${r.id}`}>Ver detalhes</Link>:<span className="muted">—</span>}</td></tr>)}</tbody></table></div></Card>
  </div>
}
