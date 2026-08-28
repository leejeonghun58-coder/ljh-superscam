import type { ReactNode } from 'react';

export default function AlertRow({ tone = 'warning', children }: { tone?: 'warning' | 'critical' | 'info'; children: ReactNode }) {
  return <div className={`alert-row alert-row-${tone}`} role="status">{children}</div>;
}
