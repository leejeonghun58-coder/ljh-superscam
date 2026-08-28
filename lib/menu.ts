export type MenuItem = { label: string; href: string; section: 'USER' | 'ADMIN' };

export const USER_MENU: MenuItem[] = [
  { label: '전체 현황', href: '/', section: 'USER' },
  { label: '리드타임 격차', href: '/analysis/leadtime', section: 'USER' },
  { label: '재고 소진 위험', href: '/analysis/stockout', section: 'USER' },
];

export const ADMIN_MENU: MenuItem[] = [
  { label: '관리자 홈', href: '/admin', section: 'ADMIN' },
  { label: '사용자 관리', href: '/admin/users', section: 'ADMIN' },
];

export const MENU = { USER: USER_MENU, ADMIN: ADMIN_MENU } as const;
