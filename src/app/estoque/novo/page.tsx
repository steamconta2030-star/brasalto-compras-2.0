import Link from 'next/link';
import { createInventoryItem } from '../../../actions/inventory';
import { Field, FormCard } from '../../../components/forms/forms';
import { PageHeader } from '../../../components/ui';
import { getInventoryReferenceData } from '../../../lib/database';
import { requirePermission } from '../../../lib/auth';
import { SubmitButton } from '../../../components/submit-button';

export default async function Page(){
  const actor=await requirePermission('INVENTORY_MANAGE');
  const ref=await getInventoryReferenceData();
  if(!ref) return <div className="page"><PageHeader title="Novo item de estoque" subtitle="Cadastre o inventário inicial."/><div className="notice notice-warn">Banco indisponível.</div></div>;
  const units=actor.unitId&&!actor.permissions.has('ADMIN_ALL')?ref.units.filter(u=>u.id===actor.unitId):ref.units;
  return <div className="page"><PageHeader title="Novo item de estoque" subtitle="Informe o saldo inicial e a regra de reposição. O histórico de consumo refinará a previsão com o uso." action={<Link className="button button-secondary" href="/estoque">Voltar</Link>}/>
    <FormCard title="Inventário e parâmetros" subtitle="Para começar, informe uma estimativa de consumo diário. O histórico só assume a previsão quando houver tempo e lançamentos suficientes.">
      <form action={createInventoryItem} className="form-grid">
        <Field label="Unidade"><select name="unitId" required>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Categoria"><select name="categoryId"><option value="">Sem categoria</option>{ref.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Item"><input name="name" required list="recurring-items" placeholder="Ex.: Pó de café 500 g"/>
          <datalist id="recurring-items">
            <option value="Pó de café 500 g"/><option value="Açúcar 5 kg"/><option value="Copo descartável"/>
            <option value="Papel higiênico"/><option value="Papel toalha"/><option value="Sabonete"/>
            <option value="Detergente"/><option value="Desinfetante"/><option value="Saco de lixo"/>
            <option value="Papel A4 / Chamex"/><option value="Caneta esferográfica"/><option value="Marca-texto"/>
            <option value="Post-it"/><option value="Grampo"/><option value="Fita adesiva"/>
          </datalist></Field>
        <Field label="Unidade de medida"><input name="unitOfMeasure" required placeholder="Ex.: PCT, UN, L, KG"/></Field>
        <Field label="Estoque atual / inventário inicial"><input name="initialStock" type="number" min="0" step="0.001" defaultValue="0" required/></Field>
        <Field label="Estoque mínimo"><input name="minimumStock" type="number" min="0" step="0.001" defaultValue="0" required/></Field>
        <Field label="Estoque alvo após compra"><input name="targetStock" type="number" min="0.001" step="0.001" placeholder="Opcional"/></Field>
        <Field label="Consumo diário estimado"><input name="estimatedDailyConsumption" type="number" min="0.001" step="0.001" placeholder="Opcional até formar histórico"/></Field>
        <Field label="Prazo médio para receber (dias)"><input name="leadTimeDays" type="number" min="0" max="365" defaultValue="7" required/></Field>
        <Field label="Margem de segurança (dias)"><input name="safetyDays" type="number" min="0" max="365" defaultValue="3" required/></Field>
        <Field label="Criticidade"><select name="criticality" defaultValue="NORMAL"><option value="NORMAL">Normal</option><option value="IMPORTANTE">Importante</option><option value="CRITICO">Crítico — não pode faltar</option></select></Field>
        <Field label="Método de reposição"><select name="replenishmentMethod" defaultValue="CONSUMO_MEDIO"><option value="CONSUMO_MEDIO">Consumo médio + prazo + segurança</option><option value="ESTOQUE_MINIMO">Estoque mínimo</option></select></Field>
        <Field label="Fornecedor principal"><select name="preferredSupplierId"><option value="">Não definido</option>{ref.suppliers.map(s=><option key={s.id} value={s.id}>{s.tradeName||s.legalName}</option>)}</select></Field>
        <Field label="Descrição" span><textarea name="description" placeholder="Marca, embalagem, especificação ou observação importante."/></Field>
        <Field label="Observações internas" span><textarea name="notes"/></Field>
        <div className="form-actions field-span"><Link className="button button-secondary" href="/estoque">Cancelar</Link><SubmitButton idleLabel="Cadastrar item" pendingLabel="Cadastrando..." /></div>
      </form>
    </FormCard>
  </div>;
}
