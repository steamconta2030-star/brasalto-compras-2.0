import Link from 'next/link';
import { Badge, Card, PageHeader } from '../../components/ui';
import { requests as demoRequests } from '../../lib/demo-data';
import { getRequests } from '../../lib/database';
import { brDate, statusLabel } from '../../lib/format';

export default async function Page(){
  const dbRows = await getRequests();
  const rows = dbRows ?? demoRequests.map(r => ({...r, date: r.date, urgency: r.urgency.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''), status:r.status}));
  return <div className="page">
    <PageHeader title="Solicitações de compra" subtitle="Registre a demanda antes da cotação e acompanhe cada etapa do processo." action={<Link className="button" href="/solicitacoes/nova">+ Nova solicitação</Link>}/>
    {!dbRows && <div className="notice">Modo demonstração: configure <strong>DATABASE_URL</strong> e execute as migrações/seed para ativar persistência PostgreSQL.</div>}
    <Card><div className="toolbar"><input placeholder="Buscar código, item ou solicitante..."/><select><option>Todas as unidades</option></select><select><option>Todos os status</option><option>Em cotação</option><option>Aguardando aprovação</option></select></div>
    <div className="table-wrap"><table><thead><tr><th>Código</th><th>Data</th><th>Unidade</th><th>Descrição</th><th>Solicitante</th><th>Urgência</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rows.map(r=><tr key={r.code}><td><strong>{r.code}</strong></td><td>{typeof r.date === 'string' ? r.date : brDate(r.date)}</td><td>{r.unit}</td><td>{r.item}</td><td>{r.requester}</td><td><Badge tone={String(r.urgency).includes('ALTA')||String(r.urgency).includes('URGENTE')?'warn':'neutral'}>{statusLabel(String(r.urgency))}</Badge></td><td><Badge tone="info">{statusLabel(r.status)}</Badge></td><td>{'id' in r && r.id?<Link className="button button-small button-secondary" href={`/solicitacoes/${r.id}`}>Ver detalhes</Link>:<span className="muted">—</span>}</td></tr>)}</tbody></table></div></Card>
  </div>
}
