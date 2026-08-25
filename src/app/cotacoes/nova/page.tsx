import { requirePermission } from '../../../lib/auth';
import Link from 'next/link';
import { createQuotation } from '../../../actions/purchases';
import { FormCard, Field } from '../../../components/forms/forms';
import { PageHeader } from '../../../components/ui';
import { SubmitButton } from '../../../components/submit-button';
import { getReferenceData, getRequestDetail } from '../../../lib/database';

export default async function Page({searchParams}:{searchParams:Promise<{requestId?:string}>}){
  await requirePermission('QUOTATION_MANAGE');
  const params=await searchParams;
  const data=await getReferenceData();
  const selectedRequestId=params.requestId??'';
  const selectedRequest=selectedRequestId?await getRequestDetail(selectedRequestId):null;

  return <div className="page">
    <PageHeader title="Inserir cotação" subtitle="Registre preço, prazo e principalmente a condição de pagamento." action={<Link className="button button-secondary" href={selectedRequest?`/solicitacoes/${selectedRequest.id}`:'/cotacoes'}>Voltar</Link>}/>
    {!data?<div className="notice notice-warn">Conecte o PostgreSQL para registrar cotações.</div>:
    <>
      {selectedRequest&&<div className="notice quote-request-context"><strong>{selectedRequest.code} · {selectedRequest.description}</strong><span>{selectedRequest.unit} · {selectedRequest.items.map(i=>`${i.quantity.toLocaleString('pt-BR')} ${i.unitOfMeasure} ${i.product}`).join(' · ')}</span>{selectedRequest.origin==='ESTOQUE'&&<span>Origem: reposição automática de estoque</span>}</div>}
      <FormCard title="Proposta do fornecedor" subtitle="A comparação comercial será recalculada automaticamente após salvar.">
        <form action={createQuotation} className="form-grid">
          <Field label="Solicitação"><select name="requestId" required defaultValue={selectedRequestId}><option value="">Selecione</option>{data.requests.map(x=><option key={x.id} value={x.id}>{x.code} · {x.description}</option>)}</select></Field>
          <Field label="Fornecedor"><select name="supplierId" required><option value="">Selecione</option>{data.suppliers.map(x=><option key={x.id} value={x.id}>{x.tradeName||x.legalName}</option>)}</select></Field>
          <Field label="Valor total"><input name="total" type="number" min="0.01" step="0.01" required/></Field>
          <Field label="Condição de pagamento"><select name="paymentTermId" required><option value="">Selecione</option>{data.paymentTerms.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Dias para pagamento"><input name="paymentDays" type="number" min="0" defaultValue="0"/></Field>
          <Field label="Prazo de entrega (dias)"><input name="deliveryDays" type="number" min="0"/></Field>
          <Field label="Desconto"><input name="discount" type="number" min="0" step="0.01" defaultValue="0"/></Field>
          <Field label="Frete"><input name="freight" type="number" min="0" step="0.01" defaultValue="0"/></Field>
          <Field label="Observações" span><textarea name="notes" placeholder="Validade, contato, condição especial, observações da proposta..."/></Field>
          <div className="form-actions field-span"><Link className="button button-secondary" href={selectedRequest?`/solicitacoes/${selectedRequest.id}`:'/cotacoes'}>Cancelar</Link><SubmitButton idleLabel="Salvar cotação" pendingLabel="Salvando cotação..." /></div>
        </form>
      </FormCard>
    </>}
  </div>;
}
