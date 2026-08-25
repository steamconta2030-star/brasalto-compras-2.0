import type { ReactNode } from 'react';

export function FormCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="card form-card"><div className="section-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</section>;
}

export function Field({ label, children, span = false }: { label: string; children: ReactNode; span?: boolean }) {
  return <label className={span ? 'field field-span' : 'field'}><span>{label}</span>{children}</label>;
}
