import type { ReactNode } from 'react';
import AppShell from '@/components/shell/app-shell';
export default function AnalysisLayout({ children }: { children: ReactNode }) { return <AppShell title="분석">{children}</AppShell>; }