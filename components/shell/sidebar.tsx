'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { MENU, type MenuItem } from '@/lib/menu';

function MenuGroup({ label, items }: { label: string; items: MenuItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return <div className="menu-group"><span className="menu-label">{label}</span><nav className="menu-list" aria-label={label}>{items.map((item) => <Link key={item.href} href={item.href} className={`menu-item ${currentUrl === item.href ? 'active' : ''}`}>{item.label}</Link>)}</nav></div>;
}

export default function Sidebar() {
  return <aside className="app-sidebar"><div className="app-brand"><span className="app-brand-mark">OP</span><span><strong>월간 발주계획</strong><small>Procurement Planning</small></span></div><MenuGroup label="WORKFLOW" items={MENU.WORKFLOW} /><MenuGroup label="USER" items={MENU.USER} /><MenuGroup label="ADMIN" items={MENU.ADMIN} /><form action="/logout" method="post" className="sidebar-logout"><button type="submit">로그아웃</button></form><div className="sidebar-footer">한국후지필름BI<br /><span>SCM Prototype · Phase 1</span></div></aside>;
}
