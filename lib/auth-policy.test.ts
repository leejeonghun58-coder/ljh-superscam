import test from 'node:test';
import assert from 'node:assert/strict';
import { canChangeUserAccess, isActiveAdmin, type AccessRecord } from './auth-policy.ts';

test('활성 ADMIN만 관리자 권한을 가진다', () => {
  assert.equal(isActiveAdmin({ role: 'ADMIN', active: true }), true);
  assert.equal(isActiveAdmin({ role: 'ADMIN', active: false }), false);
  assert.equal(isActiveAdmin({ role: 'USER', active: true }), false);
});

test('관리자는 자기 자신의 role과 active를 바꿀 수 없다', () => {
  const admin: AccessRecord = { userId: 'u1', role: 'ADMIN', active: true };
  assert.equal(canChangeUserAccess(admin, admin.userId, { role: 'USER' }), false);
  assert.equal(canChangeUserAccess(admin, admin.userId, { active: false }), false);
  assert.equal(canChangeUserAccess(admin, 'u2', { role: 'USER' }), true);
});
