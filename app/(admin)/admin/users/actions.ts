'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { canChangeUserAccess, type AccessRole } from '@/lib/auth-policy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export type UserActionState = { error: string | null };
export async function updateUserAccess(_previous: UserActionState, formData: FormData): Promise<UserActionState> {
  const actor = await requireAdmin();
  const targetUserId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? 'USER');
  const activeValues = formData.getAll('active');
  const active = activeValues[activeValues.length - 1] === 'true';
  if (!targetUserId || (role !== 'ADMIN' && role !== 'USER')) return { error: '잘못된 사용자 변경 요청입니다.' };
  if (!canChangeUserAccess({ userId: actor.profile.user_id, role: actor.profile.role, active: actor.profile.active }, targetUserId, { role: role as AccessRole, active })) return { error: '자기 자신의 관리자 권한 또는 활성 상태는 변경할 수 없습니다.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').from('app_user').update({ role, active }).eq('user_id', targetUserId);
  if (error) return { error: error.message };
  revalidatePath('/admin/users');
  return { error: null };
}