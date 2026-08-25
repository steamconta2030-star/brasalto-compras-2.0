import { createApprovalRule, toggleApprovalRule } from '../../actions/governance';
import { Badge, Card, Money, PageHeader } from '../../components/ui';
import { requirePermission } from '../../lib/auth';
import { prisma } from '../../lib/prisma';

export default async function Page(){
  await requirePermission('USER_MANAGE');
  const [rules,roles,units]=await Promise.all([
    prisma.approvalRule.findMany({include:{role:true,unit:true},orderBy:[{priority:'asc'},{minAmount:'asc'}]}),
    prisma.role.findMany({where:{permissions:{some:{permission:{key:'APPROVAL_DECIDE'}}}},orderBy:{name:'asc'}}),
    prisma.unit.findMany({where:{active:true},orderBy:{name:'asc'}}),
  ]);
  return <div className="page"><PageHeader title="Alçadas de aprovação" subtitle="Defina quem aprova conforme valor, unidade e divergência da recomendação comercial."/>
    <Card className="form-card"><div className="section-title"><div><h2>Nova regra</h2><p>Regras com menor prioridade numérica são avaliadas primeiro.</p></div></div><form action={createApprovalRule} className="form-grid">
      <label className="field"><span>Nome</span><input name="name" required placeholder="Ex.: Compras até R$ 5.000"/></label>
      <label className="field"><span>Perfil aprovador</span><select name="roleId" required><option value="">Selecione</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label className="field"><span>Unidade</span><select name="unitId"><option value="">Todas</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label className="field"><span>Valor mínimo</span><input name="minAmount" type="number" step="0.01" min="0" defaultValue="0" required/></label>
      <label className="field"><span>Valor máximo</span><input name="maxAmount" type="number" step="0.01" min="0" placeholder="Sem limite"/></label>
      <label className="field"><span>Prioridade</span><input name="priority" type="number" min="1" defaultValue="100"/></label>
      <label className="check-field field-span"><input name="requireOnDivergence" type="checkbox"/> Aplicar especialmente quando a escolha divergir da recomendação do sistema</label>
      <div className="field-span"><button className="button" type="submit">Salvar regra</button></div>
    </form></Card>
    <Card><div className="table-wrap"><table><thead><tr><th>Regra</th><th>Unidade</th><th>Perfil</th><th>Faixa</th><th>Divergência</th><th>Prioridade</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rules.map(r=><tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.unit?.name||'Todas'}</td><td>{r.role.name}</td><td><Money value={Number(r.minAmount)}/> — {r.maxAmount?<Money value={Number(r.maxAmount)}/>:<span>sem limite</span>}</td><td>{r.requireOnDivergence?<Badge tone="warn">SIM</Badge>:<Badge>NÃO</Badge>}</td><td>{r.priority}</td><td><Badge tone={r.active?'good':'neutral'}>{r.active?'ATIVA':'INATIVA'}</Badge></td><td><form action={toggleApprovalRule}><input type="hidden" name="ruleId" value={r.id}/><button className="link-button" type="submit">{r.active?'Desativar':'Ativar'}</button></form></td></tr>)}</tbody></table></div></Card>
  </div>;
}
