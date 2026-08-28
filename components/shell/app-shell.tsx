import type { ReactNode } from 'react';
import type { AccessRole } from '@/lib/auth-policy';
import Sidebar from './sidebar';
import Topbar from './topbar';

export default function AppShell({ children, title, role = 'USER' }: { children: ReactNode; title?: string; role?: AccessRole }) {
  return <div className="app-shell-v2"><Sidebar role={role} /><main className="app-main"><Topbar title={title} /><div className="app-content">{children}</div></main></div>;
}
