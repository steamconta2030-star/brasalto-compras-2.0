import Link from 'next/link';
import { PageHeader, Card } from '../../../components/ui';
import { requirePermission } from '../../../lib/auth';
import { getInventoryReferenceData } from '../../../lib/database';
import { createBulkInventoryItems } from '../../../actions/inventory';

const defaults = [
  {group:'Copa e limpeza',name:'Pó de café 500 g',unit:'PCT',criticality:'CRITICO'},
  {group:'Copa e limpeza',name:'Açúcar 5 kg',unit:'PCT',criticality:'IMPORTANTE'},
  {group:'Copa e limpeza',name:'Copo descartável',unit:'PCT',criticality:'IMPORTANTE'},
  {group:'Copa e limpeza',name:'Papel higiênico',unit:'PCT',criticality:'CRITICO'},
  {group:'Copa e limpeza',name:'Papel toalha',unit:'PCT',criticality:'CRITICO'},
  {group:'Copa e limpeza',name:'Sabonete',unit:'UN',criticality:'IMPORTANTE'},
  {group:'Copa e limpeza',name:'Detergente',unit:'UN',criticality:'IMPORTANTE'},
  {group:'Copa e limpeza',name:'Desinfetante',unit:'UN',criticality:'IMPORTANTE'},
  {group:'Copa e limpeza',name:'Saco de lixo',unit:'PCT',criticality:'IMPORTANTE'},
  {group:'Escritório',name:'Papel A4 / Chamex',unit:'CX',criticality:'IMPORTANTE'},
  {group:'Escritório',name:'Caneta esferográfica',unit:'UN',criticality:'NORMAL'},
  {group:'Escritório',name:'Marca-texto',unit:'UN',criticality:'NORMAL'},
  {group:'Escritório',name:'Post-it',unit:'UN',criticality:'NORMAL'},
  {group:'Escritório',name:'Grampo',unit:'CX',criticality:'NORMAL'},
  {group:'Escritório',name:'Fita adesiva',unit:'UN',criticality:'NORMAL'},
];

export default async function Page(){
  const actor = await requirePermission('INVENTORY_MANAGE');
  const ref = await getInventoryReferenceData();
  if(!ref) return <div className="page"><PageHeader title="Cadastro em massa" subtitle="Cadastre rapidamente materiais recorrentes por unidade."/><div className="notice notice-warn">Banco indisponível.</div></div>;
  const units=actor.unitId&&!actor.permissions.has('ADMIN_ALL')?ref.units.filter(u=>u.id===actor.unitId):ref.units;
  return <div className="page">
    <PageHeader title="Cadastro em massa" subtitle="Selecione a unidade e marque os materiais recorrentes que deseja controlar." action={<Link className="button button-secondary" href="/estoque">Voltar</Link>}/>
    <form action={createBulkInventoryItems}>
      <Card>
        <div className="form-grid">
          <label className="field"><span>Unidade</span><select name="unitId" required>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label className="field"><span>Estoque mínimo padrão</span><input name="minimumStock" type="number" min="0" step="0.001" defaultValue="1"/></label>
          <label className="field"><span>Prazo médio para receber</span><input name="leadTimeDays" type="number" min="0" max="365" defaultValue="7"/></label>
          <label className="field"><span>Margem de segurança</span><input name="safetyDays" type="number" min="0" max="365" defaultValue="3"/></label>
        </div>
      </Card>
      <div className="section-gap">
        {['Copa e limpeza','Escritório'].map(group=><Card key={group}>
          <div className="section-title"><div><h2>{group}</h2><p>Marque somente os itens realmente usados na unidade.</p></div></div>
          <div className="bulk-grid">
            {defaults.filter(i=>i.group===group).map(item=><label className="bulk-item" key={item.name}>
              <input type="checkbox" name="items" value={`${item.name}|${item.unit}|${item.criticality}`}/>
              <span><strong>{item.name}</strong><small>{item.unit} · {item.criticality==='CRITICO'?'Crítico':item.criticality==='IMPORTANTE'?'Importante':'Normal'}</small></span>
            </label>)}
          </div>
        </Card>)}
      </div>
      <div className="form-actions section-gap"><Link className="button button-secondary" href="/estoque">Cancelar</Link><button className="button" type="submit">Cadastrar selecionados</button></div>
    </form>
  </div>;
}
