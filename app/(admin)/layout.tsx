import type { ReactNode } from 'react';
import AppShell from '@/components/shell/app-shell';
export default function AdminLayout({ children }: { children: ReactNode }) { return <AppShell title="관리자">{children}</AppShell>; }