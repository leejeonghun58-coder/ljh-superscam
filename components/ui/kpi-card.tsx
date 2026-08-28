import type { ReactNode } from 'react';

export default function KpiCard({ label, value, foot, tone = 'neutral' }: { label: string; value: ReactNode; foot?: ReactNode; tone?: 'neutral' | 'safe' | 'warning' | 'critical' }) {
  return <article className={`kpi-card kpi-card-${tone}`}><span className="kpi-label">{label}</span><strong className="kpi-value">{value}</strong>{foot && <span className="kpi-foot">{foot}</span>}</article>;
}
