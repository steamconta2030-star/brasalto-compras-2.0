import Link from 'next/link';
import { createPurchaseRequest } from '../../../actions/purchases';
import { FormCard, Field } from '../../../components/forms/forms';
import { PageHeader } from '../../../components/ui';
import { getReferenceData } from '../../../lib/database';
import { requirePermission } from '../../../lib/auth';

export default async function Page(){
  const actor = await requirePermission('REQUEST_CREATE');
  const data = await getReferenceData();
  return <div className="page"><PageHeader title="Nova solicitação" subtitle="Formalize a necessidade antes de iniciar as cotações." action={<Link className="button button-secondary" href="/solicitacoes">Voltar</Link>}/>
  {!data ? <div className="notice notice-warn">O banco ainda não está conectado. Configure PostgreSQL, rode <code>npm run db:migrate</code> e <code>npm run db:seed</code> para liberar este formulário.</div> :
  <FormCard title="Dados da demanda" subtitle="Os campos abaixo geram uma solicitação rastreável e pronta para cotação."><form action={createPurchaseRequest} className="form-grid">
    <Field label="Unidade"><select name="unitId" required><option value="">Selecione</option>{data.units.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Departamento"><select name="departmentId"><option value="">Não informado</option>{data.departments.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Solicitante"><input value={actor.name} disabled/><input type="hidden" name="requesterId" value={actor.id}/></Field>
    <Field label="Categoria"><select name="categoryId"><option value="">Sem categoria</option>{data.categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Urgência"><select name="urgency" defaultValue="MEDIA"><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option></select></Field>
    <Field label="Item / produto"><input name="product" required placeholder="Ex.: Placa OSB 11 mm"/></Field>
    <Field label="Quantidade"><input name="quantity" required type="number" min="0.001" step="0.001" defaultValue="1"/></Field>
    <Field label="Unidade de medida"><input name="unitOfMeasure" required placeholder="UN, M, KG..." defaultValue="UN"/></Field>
    <Field label="Descrição da solicitação" span><textarea name="description" required placeholder="Explique claramente o que precisa ser comprado."/></Field>
    <Field label="Detalhes técnicos" span><textarea name="detail" placeholder="Medidas, marca de referência, CA, especificação técnica..."/></Field>
    <Field label="Justificativa / finalidade" span><textarea name="justification" placeholder="Onde será usado e por que a compra é necessária?"/></Field>
    <div className="form-actions field-span"><Link className="button button-secondary" href="/solicitacoes">Cancelar</Link><button className="button" type="submit">Criar solicitação</button></div>
  </form></FormCard>}
  </div>
}
