import { requirePermission } from '../../../lib/auth';
import Link from 'next/link';
import { createSupplier } from '../../../actions/purchases';
import { FormCard, Field } from '../../../components/forms/forms';
import { PageHeader } from '../../../components/ui';
import { getReferenceData } from '../../../lib/database';

export default async function Page(){
  await requirePermission('SUPPLIER_MANAGE'); const data=await getReferenceData(); return <div className="page"><PageHeader title="Cadastrar fornecedor" subtitle="Centralize dados cadastrais e comerciais usados nas cotações." action={<Link className="button button-secondary" href="/fornecedores">Voltar</Link>}/>
{!data?<div className="notice notice-warn">Conecte o PostgreSQL para habilitar cadastros persistentes.</div>:<FormCard title="Dados do fornecedor" subtitle="A condição padrão ajuda o comprador, mas cada cotação pode informar uma condição diferente."><form action={createSupplier} className="form-grid">
<Field label="Razão social"><input name="legalName" required/></Field><Field label="Nome fantasia"><input name="tradeName"/></Field><Field label="CNPJ / CPF"><input name="document" required/></Field><Field label="Inscrição estadual"><input name="stateRegistration"/></Field><Field label="Telefone"><input name="phone"/></Field><Field label="WhatsApp"><input name="whatsapp"/></Field><Field label="E-mail"><input name="email" type="email"/></Field><Field label="Vendedor / contato"><input name="salesperson"/></Field><Field label="Cidade"><input name="city"/></Field><Field label="UF"><input name="state" maxLength={2}/></Field>
<Field label="Condição padrão"><select name="defaultPaymentTermId"><option value="">Não definida</option>{data.paymentTerms.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Categoria"><select name="categoryId"><option value="">Sem categoria</option>{data.categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Unidade atendida"><select name="unitId"><option value="">Todas / não definido</option>{data.units.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Observações" span><textarea name="notes" placeholder="Prazos, particularidades, histórico comercial..."/></Field><div className="form-actions field-span"><Link className="button button-secondary" href="/fornecedores">Cancelar</Link><button className="button" type="submit">Salvar fornecedor</button></div>
</form></FormCard>}</div>}
