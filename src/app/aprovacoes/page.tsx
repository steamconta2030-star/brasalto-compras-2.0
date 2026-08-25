import { decideApproval } from '../../actions/governance';
import { Badge, Card, Money, PageHeader } from '../../components/ui';
import { requirePermission } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import { SubmitButton } from '../../components/submit-button';

export default async function Page({searchParams}:{searchParams:Promise<{requestId?:string;created?:string}>}){
  const params=await searchParams;
  const actor = await requirePermission('APPROVAL_DECIDE');
  const isAdmin = actor.permissions.has('ADMIN_ALL');
  const approvals = await prisma.approval.findMany({
    where: isAdmin ? { status:'PENDENTE' } : { status:'PENDENTE', approverId:actor.id },
    include:{ request:{include:{unit:true}}, quotation:{include:{supplier:true,paymentTerm:true}}, rule:true },
    orderBy:{createdAt:'asc'}
  });
  return <div className="page"><PageHeader title="Aprovações" subtitle="Fila de decisões pendentes conforme as alçadas configuradas." />
    {params.created==='1'&&<div className="notice notice-good"><strong>Solicitação enviada para aprovação.</strong> A decisão já está na fila da alçada responsável.</div>}
    <Card><div className="table-wrap"><table><thead><tr><th>Solicitação</th><th>Unidade</th><th>Fornecedor</th><th>Valor</th><th>Pagamento</th><th>Alçada</th><th>Ação</th></tr></thead><tbody>
      {approvals.map(a=><tr key={a.id} className={params.requestId===a.requestId?'highlight':''}><td><strong>{a.request.code}</strong></td><td>{a.request.unit.name}</td><td>{a.quotation?.supplier.tradeName || a.quotation?.supplier.legalName || '—'}</td><td><Money value={Number(a.selectedTotal||0)}/></td><td>{a.quotation?.paymentTerm.name || '—'}</td><td><Badge tone="warn">{a.rule?.name || 'Sem regra'}</Badge></td><td><form action={decideApproval} className="approval-actions"><input type="hidden" name="approvalId" value={a.id}/><input name="justification" placeholder="Motivo se reprovar"/><SubmitButton className="button button-small" name="decision" value="APROVADA" idleLabel="Aprovar" pendingLabel="Processando..." /><SubmitButton className="button button-secondary button-small" name="decision" value="REPROVADA" idleLabel="Reprovar" pendingLabel="Processando..." /></form></td></tr>)}
      {!approvals.length && <tr><td colSpan={7}><div className="empty-state">Nenhuma aprovação pendente para seu perfil.</div></td></tr>}
    </tbody></table></div></Card>
  </div>;
}
