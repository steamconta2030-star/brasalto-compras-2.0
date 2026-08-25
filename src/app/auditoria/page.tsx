import Link from 'next/link';
import { Badge, Card, PageHeader } from '../../components/ui';
import { requirePermission } from '../../lib/auth';
import { prisma } from '../../lib/prisma';

const entityLabel:Record<string,string>={
  PurchaseRequest:'Solicitação',Quotation:'Cotação',Approval:'Aprovação',PurchaseOrder:'Pedido',
  Receipt:'Recebimento',InventoryItem:'Estoque',StockMovement:'Movimentação',User:'Usuário',Supplier:'Fornecedor'
};
function eventLabel(value:unknown){
  if(!value || typeof value!=='object') return 'Alteração registrada';
  const v=value as Record<string,unknown>;
  const action=String(v.action??'').toUpperCase();
  return (({CREATE:'Criação',SUBMIT:'Enviado para aprovação',DECIDE:'Decisão',CREATE_AUTO_AFTER_APPROVAL:'Pedido automático'} as Record<string,string>)[action] ?? action) || 'Alteração registrada';
}

export default async function Page({searchParams}:{searchParams:Promise<{requestId?:string}>}){
  await requirePermission('AUDIT_VIEW');
  const params=await searchParams;
  let recordIds:string[]|undefined;
  let requestCode:string|undefined;
  if(params.requestId){
    const request=await prisma.purchaseRequest.findUnique({
      where:{id:params.requestId},
      include:{quotations:{select:{id:true}},approvals:{select:{id:true}},orders:{include:{receipts:{select:{id:true}}}}},
    });
    if(request){
      requestCode=request.code;
      recordIds=[
        request.id,
        ...request.quotations.map(x=>x.id),
        ...request.approvals.map(x=>x.id),
        ...request.orders.flatMap(o=>[o.id,...o.receipts.map(r=>r.id)]),
      ];
    }
  }
  const logs=await prisma.auditLog.findMany({
    where:recordIds?{recordId:{in:recordIds}}:undefined,
    include:{user:true},orderBy:{createdAt:'desc'},take:300
  });

  return <div className="page">
    <PageHeader title={requestCode?`Auditoria · ${requestCode}`:'Auditoria'} subtitle="Registro técnico das principais decisões e alterações do processo."
      action={params.requestId?<Link className="button button-secondary" href={`/solicitacoes/${params.requestId}`}>Voltar à solicitação</Link>:undefined}/>
    {requestCode&&<div className="notice">Exibindo somente eventos técnicos relacionados à solicitação <strong>{requestCode}</strong>.</div>}
    <Card>
      <div className="table-wrap"><table><thead><tr><th>Data/hora</th><th>Usuário</th><th>Área</th><th>Evento</th><th>Campo</th><th>Registro</th></tr></thead>
      <tbody>{logs.map(log=><tr key={log.id}>
        <td>{log.createdAt.toLocaleString('pt-BR')}</td>
        <td><strong>{log.user.name}</strong></td>
        <td><Badge tone="info">{entityLabel[log.entity]??log.entity}</Badge></td>
        <td>{eventLabel(log.newValue)}</td>
        <td>{log.field||'—'}</td>
        <td><code>{log.recordId.slice(0,8)}…</code></td>
      </tr>)}
      {!logs.length&&<tr><td colSpan={6}><div className="empty-state">Nenhum evento de auditoria encontrado para este filtro.</div></td></tr>}
      </tbody></table></div>
    </Card>
  </div>;
}
