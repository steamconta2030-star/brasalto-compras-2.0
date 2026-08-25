import Link from 'next/link';
import { Badge, Card, PageHeader } from '../../components/ui';
import { suppliers as demoSuppliers } from '../../lib/demo-data';
import { getSuppliers } from '../../lib/database';
import { requirePermission } from '../../lib/auth';

export default async function Page(){
  await requirePermission('SUPPLIER_MANAGE');
  const dbRows = await getSuppliers(); const rows = dbRows ?? demoSuppliers;
  return <div className="page"><PageHeader title="Fornecedores" subtitle="Base única de contatos, categorias atendidas e condições comerciais." action={<Link className="button" href="/fornecedores/novo">+ Cadastrar fornecedor</Link>}/>
  {!dbRows && <div className="notice">Modo demonstração: os cadastros reais serão exibidos assim que o PostgreSQL estiver configurado.</div>}
  <Card><div className="toolbar"><input placeholder="Buscar fornecedor..."/><select><option>Todas as categorias</option><option>EPI</option><option>Materiais</option><option>Locação</option></select></div><div className="table-wrap"><table><thead><tr><th>Fornecedor</th><th>Localidade</th><th>Categoria</th><th>Condição padrão</th><th>Documento</th><th>Situação</th></tr></thead><tbody>{rows.map((s:any)=><tr key={s.name}><td><strong>{s.name}</strong></td><td>{s.city}</td><td>{s.category}</td><td>{s.payment}</td><td>{s.document ?? '—'}</td><td><Badge tone={s.active!==false?'good':'neutral'}>{s.active!==false?'Ativo':'Inativo'}</Badge></td></tr>)}</tbody></table></div></Card></div>
}
