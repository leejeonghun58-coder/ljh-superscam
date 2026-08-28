export type WorkflowStepId = 'dashboard' | 'demand' | 'supply' | 'master' | 'calculation' | 'report';
export type MenuItem = { label: string; href: string; section: 'WORKFLOW' | 'USER' | 'ADMIN' };

export const WORKFLOW_MENU: MenuItem[] = [
  { label: '전체 현황', href: '/workflow?step=dashboard', section: 'WORKFLOW' },
  { label: '수요 확정', href: '/workflow?step=demand', section: 'WORKFLOW' },
  { label: '재고·공급', href: '/workflow?step=supply', section: 'WORKFLOW' },
  { label: '마스터 검증', href: '/workflow?step=master', section: 'WORKFLOW' },
  { label: '발주량 계산', href: '/workflow?step=calculation', section: 'WORKFLOW' },
  { label: '보고자료', href: '/workflow?step=report', section: 'WORKFLOW' },
];

export const USER_MENU: MenuItem[] = [
  { label: '리드타임 격차', href: '/analysis/leadtime', section: 'USER' },
  { label: '재고 소진 위험', href: '/analysis/stockout', section: 'USER' },
];

export const ADMIN_MENU: MenuItem[] = [
  { label: '관리자 홈', href: '/admin', section: 'ADMIN' },
  { label: '사용자 관리', href: '/admin/users', section: 'ADMIN' },
  { label: 'Forecast 설정', href: '/admin/forecast-settings', section: 'ADMIN' },
  { label: 'Data Management', href: '/admin/data-management', section: 'ADMIN' },
];

export const MENU = { WORKFLOW: WORKFLOW_MENU, USER: USER_MENU, ADMIN: ADMIN_MENU } as const;
