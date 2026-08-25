import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, PageHeader, Money } from '../../../components/ui';
import { getPurchaseTrace, getRequestDetail } from '../../../lib/database';
import { brDate, statusLabel } from '../../../lib/format';
import { requirePermission } from '../../../lib/auth';
import { deleteQuotation } from '../../../actions/purchases';
import { SubmitButton } from '../../../components/submit-button';

export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{quotation?:string}>}){
  const actor = await requirePermission('REQUEST_CREATE');
  const {id}=await params;
  const query=await searchParams;
  const unitScope = actor.permissions.has('ADMIN_ALL') ? null : actor.unitId;
  const [request,trace]=await Promise.all([getRequestDetail(id, unitScope),getPurchaseTrace(id)]);
  if(!request) notFound();

  const canQuote=['AGUARDANDO_COTACAO','EM_COTACAO'].includes(request.status);

  return <div className="page">
    <PageHeader
      title={`${request.code} · ${request.description}`}
      subtitle="Detalhes da solicitação e continuidade do fluxo de compra."
      action={<div className="header-actions">
        <Link className="button button-secondary" href="/solicitacoes">Voltar</Link>
        {canQuote&&<Link className="button" href={`/cotacoes/nova?requestId=${request.id}`}>Iniciar cotação</Link>}
      </div>}
    />
    {query.quotation==='duplicate-blocked'&&<div className="notice notice-warn">Envio duplicado bloqueado: a cotação já havia sido registrada.</div>}
    {query.quotation==='deleted'&&<div className="notice">Cotação excluída com sucesso.</div>}

    <div className="management-strip">
      <div><span>Status</span><strong>{statusLabel(request.status)}</strong></div>
      <div><span>Origem</span><strong>{request.origin==='ESTOQUE'?'Reposição de estoque':'Solicitação manual'}</strong></div>
      <div><span>Unidade</span><strong>{request.unit}</strong></div>
      <div><span>Solicitante</span><strong>{request.requester}</strong></div>
    </div>

    <Card>
      <div className="request-detail-grid">
        <div><span>Data</span><strong>{brDate(request.requestedAt)}</strong></div>
        <div><span>Urgência</span><strong>{statusLabel(request.urgency)}</strong></div>
        <div><span>Categoria</span><strong>{request.category??'Sem categoria'}</strong></div>
        <div><span>Departamento</span><strong>{request.department??'Não informado'}</strong></div>
      </div>
      {request.justification&&<div className="detail-note"><span>Justificativa</span><p>{request.justification}</p></div>}
    </Card>

    <Card className="section-gap">
      <div className="section-title"><div><h2>Itens solicitados</h2><p>Quantidades que seguirão para cotação.</p></div>{request.origin==='ESTOQUE'&&<Badge tone="info">ORIGEM: ESTOQUE</Badge>}</div>
      <div className="table-wrap"><table><thead><tr><th>Item</th><th>Detalhe</th><th>Quantidade</th><th>Unidade</th><th>Vínculo</th></tr></thead>
      <tbody>{request.items.map(item=><tr key={item.id}><td><strong>{item.product}</strong></td><td>{item.detail||'—'}</td><td>{item.quantity.toLocaleString('pt-BR')}</td><td>{item.unitOfMeasure}</td><td>{item.inventoryItemId?<Badge tone="good">ESTOQUE VINCULADO</Badge>:<Badge>MANUAL</Badge>}</td></tr>)}</tbody></table></div>
    </Card>

    <Card className="section-gap">
      <div className="section-title"><div><h2>Cotações registradas</h2><p>Propostas já vinculadas a esta solicitação.</p></div><div className="header-actions">{!canQuote&&request.quotations.length>0&&<Badge tone="good">HISTÓRICO PROTEGIDO</Badge>}{canQuote&&request.quotations.length>0&&<Link className="button button-secondary button-small" href={`/cotacoes?requestId=${request.id}`}>Comparar propostas</Link>}{canQuote&&<Link className="button button-small quote-add-button" href={`/cotacoes/nova?requestId=${request.id}`}>Adicionar cotação</Link>}</div></div>
      {request.quotations.length===0?<div className="empty-state">Nenhuma cotação registrada ainda.</div>:
      <div className="table-wrap"><table><thead><tr><th>Fornecedor</th><th>Total</th><th>Pagamento</th><th>Data</th>{canQuote&&<th>Ação</th>}</tr></thead>
      <tbody>{request.quotations.map(q=><tr key={q.id}><td><strong>{q.supplier}</strong></td><td><Money value={q.total}/></td><td>{q.payment}</td><td>{brDate(q.quotedAt)}</td>{canQuote&&<td><form action={deleteQuotation}><input type="hidden" name="quotationId" value={q.id}/><SubmitButton className="link-button danger-link" idleLabel="Excluir" pendingLabel="Excluindo..." /></form></td>}</tr>)}</tbody></table></div>}
    </Card>

    <Card className="section-gap">
      <div className="section-title"><div><h2>Linha do tempo da compra</h2><p>Rastreabilidade do processo, da solicitação ao pagamento.</p></div><Link href={`/auditoria?requestId=${request.id}`}>Ver auditoria técnica</Link></div>
      {!trace?.length?<div className="empty-state">Ainda não há eventos suficientes para montar a linha do tempo.</div>:
      <div className="trace-list">{trace.map((event,index)=><div className="trace-event" key={`${event.type}-${event.at.toISOString()}-${index}`}>
        <div className={`trace-dot trace-dot-${event.tone}`}></div>
        <div className="trace-content"><div className="trace-head"><strong>{event.title}</strong><span>{event.at.toLocaleString('pt-BR')}</span></div><p>{event.description}</p>{event.actor&&<small>Responsável: {event.actor}</small>}</div>
      </div>)}</div>}
    </Card>
  </div>;
}
