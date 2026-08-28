import type { ReactNode } from 'react';
import AppShell from '@/components/shell/app-shell';
import { requireAdmin } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: ReactNode }) { await requireAdmin(); return <AppShell title="관리자">{children}</AppShell>; }