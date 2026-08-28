import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';
import { isActiveAdmin, type AccessRole } from './auth-policy';
export type AuthContext = { user: { id: string; email?: string | null }; profile: { user_id: string; email: string | null; name: string | null; department: string | null; role: AccessRole; active: boolean } };
export async function getRole(): Promise<AccessRole | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.schema('core').from('app_user').select('role, active').eq('user_id', user.id).maybeSingle();
  return data?.active && (data.role === 'ADMIN' || data.role === 'USER') ? data.role : null;
}
export async function requireUser(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error } = await supabase.schema('core').from('app_user').select('user_id, email, name, department, role, active').eq('user_id', user.id).maybeSingle();
  if (error || !profile || !profile.active || (profile.role !== 'ADMIN' && profile.role !== 'USER')) redirect('/login?error=inactive');
  return { user: { id: user.id, email: user.email }, profile: profile as AuthContext['profile'] };
}
export async function requireAdmin(): Promise<AuthContext> {
  const context = await requireUser();
  if (!isActiveAdmin(context.profile)) { const { forbidden } = await import('next/navigation'); forbidden(); }
  return context;
}