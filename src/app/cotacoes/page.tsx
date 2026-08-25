import Link from 'next/link';
import { approveRecommendedQuotation } from '../../actions/purchases';
import { Badge, Card, Money, PageHeader } from '../../components/ui';
import { quotationExample } from '../../lib/demo-data';
import { getQuotationComparison } from '../../lib/database';
import { recommendQuotation } from '../../domain/quotation/recommendation';
import { requirePermission } from '../../lib/auth';
import { SubmitButton } from '../../components/submit-button';

export default async function Page({searchParams}:{searchParams:Promise<{requestId?:string;approval?:string}>}){
  await requirePermission('QUOTATION_MANAGE');
  const params=await searchParams;
  const db=await getQuotationComparison(params.requestId);
  const code=db?.code??'SC-2026-0043';
  const candidates=db?.quotations??quotationExample.map((q,i)=>({id:String(i),supplierId:String(i),supplierName:q.supplier,total:q.total,payment:{name:q.payment,rank:q.rank,postReceipt:q.rank<=4,paymentDays:q.payment.includes('30')?30:0},deliveryDays:Number(q.delivery.split(' ')[0])}));
  const normalized=candidates.map(c=>({...c,deliveryDays:c.deliveryDays??undefined}));
  const result=recommendQuotation(normalized,5);
  const quoteCount=candidates.length;

  return <div className="page">
    <PageHeader title="Comparativo de cotações" subtitle="Preço, condição de pagamento e prazo de entrega participam da decisão."
      action={<div className="header-actions">{db&&<Link className="button button-secondary" href={`/solicitacoes/${db.requestId}`}>Voltar à solicitação</Link>}<Link className="button" href={db?`/cotacoes/nova?requestId=${db.requestId}`:'/cotacoes/nova'}>+ Inserir cotação</Link></div>}/>
    {params.approval==='pending'&&<div className="notice notice-good"><strong>Cotação enviada para aprovação.</strong> A solicitação foi encaminhada para a alçada responsável e já está disponível em Aprovações.</div>}
    {!db&&<div className="notice">Modo demonstração: quando houver cotações gravadas no PostgreSQL, esta tela usará os dados reais.</div>}
    {db&&quoteCount<3&&<div className="notice notice-warn"><strong>{quoteCount} de 3 propostas registradas.</strong> Sempre que possível, compare até 3 fornecedores antes da decisão. Você pode continuar a cotação ou enviar para aprovação quando a compra exigir decisão imediata.</div>}

    <div className="quote-summary">
      <Card><span>Menor preço</span><strong><Money value={result.menorPreco.total}/></strong><small>{result.menorPreco.supplierName}</small></Card>
      <Card className="recommended"><span>Recomendação comercial</span><strong>{result.recomendada?.supplierName??'Decisão manual'}</strong><small>{result.reason}</small></Card>
      <Card><span>Propostas comparadas</span><strong>{quoteCount}</strong><small>Tolerância comercial: 5,00%</small></Card>
    </div>

    <Card>
      <div className="section-title"><div><h2>{code} · Comparação</h2><p>O sistema separa menor preço da melhor decisão comercial e prioriza condição de pagamento favorável.</p></div><Badge tone={result.recomendada?'good':'warn'}>{result.recomendada?'RECOMENDAÇÃO AUTOMÁTICA':'DECISÃO DO COMPRADOR'}</Badge></div>
      <div className="table-wrap"><table><thead><tr><th>Fornecedor</th><th>Valor total</th><th>Pagamento</th><th>Entrega</th><th>Diferença p/ menor</th><th>Leitura do sistema</th></tr></thead>
      <tbody>{candidates.map(q=>{const rec=result.recomendada?.id===q.id;const low=result.menorPreco.id===q.id;const diff=result.menorPreco.total?((q.total-result.menorPreco.total)/result.menorPreco.total)*100:0;return <tr key={q.id} className={rec?'highlight':''}><td><strong>{q.supplierName}</strong></td><td><Money value={q.total}/></td><td>{q.payment.name}<small className="table-sub">{q.payment.paymentDays} dia(s)</small></td><td>{q.deliveryDays==null?'Não informado':`${q.deliveryDays} dias`}</td><td>{diff.toFixed(2)}%</td><td>{rec?<Badge tone="good">RECOMENDADO</Badge>:low?<Badge tone="info">MENOR PREÇO</Badge>:<Badge>ALTERNATIVA</Badge>}</td></tr>})}</tbody></table></div>

      <div className="decision-box">
        <div><strong>{result.recomendada?`Por que ${result.recomendada.supplierName}?`:'Atenção do comprador necessária'}</strong><p>{result.reason}</p>{db&&quoteCount<3&&<p className="muted">Boa prática: registrar até 3 propostas quando houver fornecedores disponíveis.</p>}</div>
        {db&&<form action={approveRecommendedQuotation} className="decision-form">
          <input type="hidden" name="requestId" value={db.requestId}/>
          <select name="quotationId" required defaultValue={result.recomendada?.id??''}><option value="">Escolha uma cotação</option>{candidates.map(q=><option key={q.id} value={q.id}>{q.supplierName} · {q.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · {q.payment.name}</option>)}</select>
          <input name="justification" placeholder="Justificativa se divergir da recomendação"/>
          <SubmitButton idleLabel="Selecionar e enviar para aprovação" pendingLabel="Enviando para aprovação..." />
        </form>}
      </div>
    </Card>
  </div>;
}
