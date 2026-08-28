export type AccessRole = 'ADMIN' | 'USER';
export type AccessRecord = { userId: string; role: AccessRole; active: boolean };
export function isActiveAdmin(record: Pick<AccessRecord, 'role' | 'active'> | null | undefined) { return record?.role === 'ADMIN' && record.active === true; }
export function canChangeUserAccess(actor: AccessRecord, targetUserId: string, changes: { role?: AccessRole; active?: boolean }) {
  if (!isActiveAdmin(actor)) return false;
  if (actor.userId === targetUserId && (changes.role !== undefined || changes.active !== undefined)) return false;
  return true;
}