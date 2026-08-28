import type { ReactNode } from 'react';
import AppShell from '@/components/shell/app-shell';
import { requireUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function AnalysisLayout({ children }: { children: ReactNode }) { await requireUser(); return <AppShell title="분석">{children}</AppShell>; }