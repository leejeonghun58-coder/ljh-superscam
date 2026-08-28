import type { ReactNode } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar';

export default function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  return <div className="app-shell-v2"><Sidebar /><main className="app-main"><Topbar title={title} /><div className="app-content">{children}</div></main></div>;
}
