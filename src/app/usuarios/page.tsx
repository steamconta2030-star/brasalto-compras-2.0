import Link from 'next/link';
import { toggleUserActive } from '../../actions/governance';
import { Badge, Card, PageHeader } from '../../components/ui';
import { requirePermission } from '../../lib/auth';
import { prisma } from '../../lib/prisma';

export default async function Page(){
  await requirePermission('USER_MANAGE');
  const users=await prisma.user.findMany({include:{unit:true,roles:{include:{role:true}}},orderBy:{name:'asc'}});
  return <div className="page"><PageHeader title="Usuários e acessos" subtitle="Cada colaborador usa seu próprio login e recebe permissões por perfil." action={<Link className="button" href="/usuarios/novo">+ Novo usuário</Link>}/>
  <Card><div className="table-wrap"><table><thead><tr><th>Usuário</th><th>E-mail</th><th>Unidade</th><th>Perfil</th><th>Status</th><th>Ação</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><strong>{u.name}</strong></td><td>{u.email}</td><td>{u.unit?.name||'Corporativo'}</td><td>{u.roles.map(r=>r.role.name).join(', ')||'Sem perfil'}</td><td><Badge tone={u.active?'good':'neutral'}>{u.active?'ATIVO':'INATIVO'}</Badge></td><td><form action={toggleUserActive}><input type="hidden" name="userId" value={u.id}/><button className="link-button" type="submit">{u.active?'Desativar':'Ativar'}</button></form></td></tr>)}</tbody></table></div></Card></div>
}
