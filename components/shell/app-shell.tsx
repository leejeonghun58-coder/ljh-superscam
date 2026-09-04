import type { ReactNode } from 'react';
import type { AppRole } from '@/lib/menu';
import Sidebar from './sidebar';
import Topbar from './topbar';

export default function AppShell({ children, title, role = 'USER' }: { children: ReactNode; title?: string; role?: AppRole }) {
  return <div className="app-shell-v2"><Sidebar role={role} /><main className="app-main"><Topbar name="SCM" role={role} /><div className="app-content">{children}</div></main></div>;
}
