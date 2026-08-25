import type { ReactNode } from 'react';
export function PageHeader({title,subtitle,action}:{title:string;subtitle:string;action?:ReactNode}){return <div className="page-header"><div><span className="eyebrow">Compras Brasauto</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}
export function Card({children,className=''}:{children:ReactNode;className?:string}){return <section className={`card ${className}`}>{children}</section>}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'good'|'warn'|'info'}){return <span className={`badge badge-${tone}`}>{children}</span>}
export function Money({value}:{value:number}){return <>{value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</>}
