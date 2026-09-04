import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU, USER_MENU, WORKFLOW_MENU, getMenuForRole } from './menu.ts';

test('기존 workflow 6단계가 공통 메뉴 정의에 모두 등록된다', () => {
  assert.deepEqual(
    WORKFLOW_MENU.map((item) => item.label),
    ['전체 현황', '수요 확정', '재고·공급', '마스터 검증', '발주량 계산', '보고자료'],
  );
});

test('workflow 메뉴는 레거시 화면의 단계 URL로 연결된다', () => {
  assert.deepEqual(
    WORKFLOW_MENU.map((item) => item.href),
    [
      '/workflow?step=dashboard',
      '/workflow?step=demand',
      '/workflow?step=supply',
      '/workflow?step=master',
      '/workflow?step=calculation',
      '/workflow?step=report',
    ],
  );
});

test('USER 메뉴에는 분석 화면이 유지된다', () => {
  assert.deepEqual(USER_MENU.map((item) => item.href), ['/analysis/leadtime', '/analysis/stockout', '/analysis/demand-profile', '/analysis/model-comparison']);
});

test('관리자 데이터 관리 메뉴가 등록된다', () => {
  assert.ok(MENU.ADMIN.some((item) => item.href === '/admin/data-management'));
});
test('USER에게 ADMIN 메뉴를 노출하지 않는다', () => {
  assert.equal(getMenuForRole('USER').ADMIN.length, 0);
  assert.ok(getMenuForRole('ADMIN').ADMIN.length > 0);
});

