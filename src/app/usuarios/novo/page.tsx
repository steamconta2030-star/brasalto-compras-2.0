import { createUser } from '../../../actions/governance';
import { FormCard, Field } from '../../../components/forms/forms';
import { PageHeader } from '../../../components/ui';
import { requirePermission } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export default async function Page(){
  await requirePermission('USER_MANAGE');
  const [units,roles]=await Promise.all([prisma.unit.findMany({where:{active:true},orderBy:{name:'asc'}}),prisma.role.findMany({orderBy:{name:'asc'}})]);
  return <div className="page"><PageHeader title="Novo usuário" subtitle="Crie o acesso individual e associe um perfil de permissão."/><FormCard title="Dados de acesso" subtitle="Use uma senha temporária e troque-a antes do uso em produção."><form action={createUser} className="form-grid"><Field label="Nome"><input name="name" required/></Field><Field label="E-mail"><input name="email" type="email" required/></Field><Field label="Senha temporária"><input name="password" type="password" minLength={8} required/></Field><Field label="Unidade"><select name="unitId"><option value="">Corporativo</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="Perfil"><select name="roleId" required><option value="">Selecione</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field><div className="field field-span"><button className="button" type="submit">Criar usuário</button></div></form></FormCard></div>
}
