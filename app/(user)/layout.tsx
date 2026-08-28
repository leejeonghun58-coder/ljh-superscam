import type { ReactNode } from 'react';
import AppShell from '@/components/shell/app-shell';
import { requireUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function UserLayout({ children }: { children: ReactNode }) { const context = await requireUser(); return <AppShell role={context.profile.role}>{children}</AppShell>; }
