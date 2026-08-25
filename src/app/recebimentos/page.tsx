import Link from 'next/link';
import { Badge, Card, PageHeader } from '../../components/ui';
import { getReceipts } from '../../lib/database';
import { receipts as demoReceipts } from '../../lib/demo-data';
import { requirePermission } from '../../lib/auth';

export default async function Page({searchParams}:{searchParams:Promise<{received?:string}>}) {
  const params = await searchParams;
  await requirePermission('RECEIPT_REGISTER');
  const db = await getReceipts(); const rows = db ?? demoReceipts;
  return <div className="page"><PageHeader title="Recebimentos" subtitle="Registre entregas parciais ou totais e ressalvas de mercadoria/serviço." action={<Link className="button" href="/recebimentos/novo">+ Registrar recebimento</Link>} />
  {params.received==='1' && <div className="notice notice-good"><strong>Recebimento registrado com sucesso.</strong> O pedido, o financeiro e o estoque vinculado foram atualizados automaticamente.</div>}
  {!db && <div className="notice">Modo demonstração: o histórico real será carregado do PostgreSQL.</div>}
  <Card><div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Item</th><th>Quantidade recebida</th><th>Data</th><th>Responsável</th><th>Status</th></tr></thead><tbody>{rows.map((r:any,i:number)=><tr key={r.id??`${r.order}-${i}`}><td><strong>{r.order}</strong></td><td>{r.item}</td><td>{r.received}</td><td>{r.date instanceof Date?r.date.toLocaleDateString('pt-BR'):r.date}</td><td>{r.responsible}</td><td><Badge tone={String(r.status).includes('RESSALVA')?'warn':'good'}>{r.status}</Badge></td></tr>)}</tbody></table></div></Card></div>;
}
