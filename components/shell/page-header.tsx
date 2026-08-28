import type { ReactNode } from 'react';

export default function PageHeader({ eyebrow = 'SCM ANALYTICS', title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
