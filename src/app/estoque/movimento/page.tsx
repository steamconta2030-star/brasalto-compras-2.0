import Link from 'next/link';
import { registerStockMovement } from '../../../actions/inventory';
import { Field, FormCard } from '../../../components/forms/forms';
import { PageHeader } from '../../../components/ui';
import { getInventoryReferenceData } from '../../../lib/database';
import { requirePermission } from '../../../lib/auth';

export default async function Page(){
  const actor=await requirePermission('INVENTORY_MANAGE');
  const ref=await getInventoryReferenceData();
  if(!ref) return <div className="page"><PageHeader title="Movimentar estoque" subtitle="Registre entrada, consumo ou ajuste."/><div className="notice notice-warn">Banco indisponível.</div></div>;
  const items=actor.unitId&&!actor.permissions.has('ADMIN_ALL')?ref.items.filter(i=>i.unitId===actor.unitId):ref.items;
  return <div className="page"><PageHeader title="Movimentar estoque" subtitle="O consumo registrado alimenta automaticamente a previsão de duração e recompra." action={<Link className="button button-secondary" href="/estoque">Voltar</Link>}/>
    <FormCard title="Nova movimentação" subtitle="Use Consumo para retiradas normais. Ajustes são indicados para correções de inventário.">
      {items.length===0?<div className="empty-state">Cadastre um item de estoque antes de registrar movimentações.</div>:<form action={registerStockMovement} className="form-grid">
        <Field label="Item"><select name="inventoryItemId" required>{items.map(i=><option key={i.id} value={i.id}>{i.name} · {i.unit.name} · saldo {Number(i.currentStock).toLocaleString('pt-BR')} {i.unitOfMeasure}</option>)}</select></Field>
        <Field label="Tipo"><select name="type" required><option value="CONSUMO">Consumo / saída normal</option><option value="ENTRADA">Entrada / reposição</option><option value="AJUSTE_ENTRADA">Ajuste positivo</option><option value="AJUSTE_SAIDA">Ajuste negativo</option></select></Field>
        <Field label="Quantidade"><input name="quantity" type="number" min="0.001" step="0.001" required/></Field>
        <Field label="Motivo / referência"><input name="reason" placeholder="Ex.: consumo diário, compra NF..., contagem física"/></Field>
        <div className="form-actions field-span"><Link className="button button-secondary" href="/estoque">Cancelar</Link><button className="button" type="submit">Registrar movimentação</button></div>
      </form>}
    </FormCard>
  </div>;
}
