import Link from 'next/link';
import { Badge, Card, PageHeader } from '../../components/ui';
import { suppliers as demoSuppliers } from '../../lib/demo-data';
import { getSuppliers } from '../../lib/database';
import { requirePermission } from '../../lib/auth';

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;category?:string}>}){
  await requirePermission('SUPPLIER_MANAGE');
  const filters=await searchParams;
  const dbRows=await getSuppliers();
  const allRows=dbRows??demoSuppliers;
  const query=(filters.q??'').trim().toLocaleLowerCase('pt-BR');
  const categories=Array.from(new Set(allRows.flatMap((s:any)=>String(s.category).split(',').map(x=>x.trim())).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const rows=allRows.filter((s:any)=>(!query||`${s.name} ${s.document??''} ${s.city}`.toLocaleLowerCase('pt-BR').includes(query))&&(!filters.category||String(s.category).split(',').map(x=>x.trim()).includes(filters.category)));
  return <div className="page"><PageHeader title="Fornecedores" subtitle="Base única de contatos, categorias atendidas e condições comerciais." action={<Link className="button" href="/fornecedores/novo">+ Cadastrar fornecedor</Link>}/>
  {!dbRows&&<div className="notice">Modo demonstração: os cadastros reais serão exibidos assim que o PostgreSQL estiver configurado.</div>}
  <Card><form className="toolbar" method="get"><input name="q" defaultValue={filters.q} placeholder="Buscar fornecedor..."/><select name="category" defaultValue={filters.category}><option value="">Todas as categorias</option>{categories.map(category=><option key={category} value={category}>{category}</option>)}</select><button className="button button-small" type="submit">Filtrar</button></form><div className="table-wrap"><table><thead><tr><th>Fornecedor</th><th>Localidade</th><th>Categoria</th><th>Condição padrão</th><th>Documento</th><th>Situação</th></tr></thead><tbody>{rows.map((s:any)=><tr key={s.name}><td><strong>{s.name}</strong></td><td>{s.city}</td><td>{s.category}</td><td>{s.payment}</td><td>{s.document??'—'}</td><td><Badge tone={s.active!==false?'good':'neutral'}>{s.active!==false?'Ativo':'Inativo'}</Badge></td></tr>)}</tbody></table></div></Card></div>;
}
