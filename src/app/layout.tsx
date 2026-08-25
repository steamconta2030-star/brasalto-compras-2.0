import type { ReactNode } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { logout } from '../actions/auth';
import { getCurrentUser } from '../lib/auth';
import './globals.css';

export const metadata = { title: 'Brasauto Compras', description: 'Gestão de compras e cotações Brasauto' };

const nav = [
  ['/', 'Dashboard', null],
  ['/solicitacoes', 'Solicitações', null],
  ['/cotacoes', 'Cotações', 'QUOTATION_MANAGE'],
  ['/aprovacoes', 'Aprovações', 'APPROVAL_DECIDE'],
  ['/fornecedores', 'Fornecedores', 'SUPPLIER_MANAGE'],
  ['/pedidos', 'Pedidos', 'PURCHASE_ORDER_CREATE'],
  ['/recebimentos', 'Recebimentos', 'RECEIPT_REGISTER'],
  ['/financeiro', 'Financeiro', 'FINANCE_VIEW'],
  ['/estoque', 'Estoque / Consumo', 'INVENTORY_MANAGE'],
  ['/indicadores', 'Indicadores', 'QUOTATION_MANAGE'],
  ['/auditoria', 'Auditoria', 'AUDIT_VIEW'],
  ['/usuarios', 'Usuários', 'USER_MANAGE'],
  ['/alcadas', 'Alçadas', 'USER_MANAGE'],
] as const;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const path = (await headers()).get('x-brasauto-pathname') ?? '/';
  const isPublic = path === '/login';
  if (isPublic) return <html lang="pt-BR"><body>{children}</body></html>;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const can = (permission: string | null) => !permission || user.permissions.has(permission) || user.permissions.has('ADMIN_ALL');
  const initials = user.name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
  return <html lang="pt-BR"><body><div className="shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">B</span><div><strong>BRASAUTO</strong><small>Gestão de Compras</small></div></div>
      <nav>{nav.filter(([, , permission])=>can(permission)).map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>
      <div className="sidebar-footer"><span className="avatar">{initials || 'U'}</span><div className="user-summary"><strong>{user.name}</strong><small>{user.roles.join(' · ') || 'Sem perfil'}</small></div><form action={logout}><button className="link-button" type="submit">Sair</button></form></div>
    </aside>
    <main className="main"><header className="topbar"><div><span className="eyebrow">Sistema interno</span><small>{user.unitName ?? 'Acesso corporativo'}</small></div><div className="status-dot">Sessão protegida</div></header>{children}</main>
  </div></body></html>;
}
