import { Badge, Card, Money, PageHeader } from '../../components/ui';
import { getInstallments } from '../../lib/database';
import { installments as demoInstallments } from '../../lib/demo-data';
import { statusLabel } from '../../lib/format';
import { requirePermission } from '../../lib/auth';
import { markInstallmentPaid, reopenInstallment } from '../../actions/finance';

export default async function Page() {
  await requirePermission('FINANCE_VIEW');
  const db = await getInstallments(); const rows = db ?? demoInstallments;
  const now = new Date();
  const openRows = rows.filter((r:any)=>String(r.status)!=='PAGA' && String(r.status)!=='CANCELADA');
  const total = openRows.reduce((sum:any,r:any)=>sum+Number(r.amount),0);
  const postReceipt = openRows.filter((r:any)=>r.postReceipt).reduce((sum:any,r:any)=>sum+Number(r.amount),0);
  const overdue = openRows.filter((r:any)=>new Date(r.due) < now).reduce((sum:any,r:any)=>sum+Number(r.amount),0);
  const paid = rows.filter((r:any)=>String(r.status)==='PAGA').reduce((sum:any,r:any)=>sum+Number(r.amount),0);

  return <div className="page"><PageHeader title="Controle financeiro de compras" subtitle="Acompanhe compromissos gerados pelos pedidos, vencimentos e pagamentos sem substituir o ERP/contabilidade." />
    {!db && <div className="notice">Modo demonstração: valores reais serão calculados a partir dos pedidos emitidos.</div>}
    <div className="quote-summary">
      <Card><span>Em aberto</span><strong><Money value={total}/></strong><small>Compromissos ainda não pagos</small></Card>
      <Card><span>Após recebimento</span><strong><Money value={postReceipt}/></strong><small>Condições que protegem o caixa</small></Card>
      <Card><span>Vencido</span><strong><Money value={overdue}/></strong><small>Exige atenção financeira</small></Card>
      <Card><span>Pago</span><strong><Money value={paid}/></strong><small>Baixas registradas no sistema</small></Card>
    </div>
    <Card><div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Fornecedor</th><th>Parcela</th><th>Valor</th><th>Vencimento</th><th>Regra</th><th>Status</th><th>Ação</th></tr></thead>
    <tbody>{rows.map((r:any,i:number)=>{
      const isPaid=String(r.status)==='PAGA';
      const isOverdue=!isPaid && String(r.status)!=='CANCELADA' && new Date(r.due)<now;
      const shownStatus=isOverdue?'VENCIDA':r.status;
      return <tr key={r.id??`${r.order}-${i}`}>
        <td><strong>{r.order}</strong></td><td>{r.supplier}</td><td>{r.installment}</td><td><Money value={Number(r.amount)}/></td>
        <td>{r.due instanceof Date?r.due.toLocaleDateString('pt-BR'):r.due}</td>
        <td>{r.postReceipt?<Badge tone="good">APÓS RECEBIMENTO</Badge>:<Badge>DATA DO PEDIDO</Badge>}</td>
        <td><Badge tone={isPaid?'good':isOverdue?'warn':String(r.status).includes('CONFIRM')?'good':'info'}>{statusLabel(shownStatus)}</Badge>{isPaid&&r.paidAt?<small style={{display:'block',marginTop:4}}>Pago em {new Date(r.paidAt).toLocaleDateString('pt-BR')}</small>:null}</td>
        <td>{db && r.id ? (isPaid ?
          <form action={reopenInstallment}><input type="hidden" name="installmentId" value={r.id}/><button className="btn btn-secondary" type="submit">Reabrir</button></form>
          : <form action={markInstallmentPaid} style={{display:'flex',gap:6,alignItems:'center'}}><input type="hidden" name="installmentId" value={r.id}/><input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0,10)} required style={{maxWidth:145}}/><button className="btn btn-primary" type="submit">Marcar pago</button></form>
        ) : '—'}</td>
      </tr>})}</tbody></table></div></Card>
    <div className="notice" style={{marginTop:16}}><strong>Escopo:</strong> este módulo controla o compromisso comercial de Compras. Pagamento bancário, conciliação e escrituração continuam no ERP/contabilidade.</div>
  </div>;
}
