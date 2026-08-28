import type { ReactNode } from 'react';

export default function Panel({ title, meta, children, className = '' }: { title?: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`.trim()}>{(title || meta) && <div className="panel-heading"><h3>{title}</h3>{meta && <span>{meta}</span>}</div>}{children}</section>;
}
