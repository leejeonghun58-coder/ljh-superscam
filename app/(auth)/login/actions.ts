'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export type LoginState = { error: string | null };
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (!email || !password) return { error: '이메일과 비밀번호를 입력해 주세요.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: '로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.' };
  await supabase.schema('core').rpc('record_login');
  redirect(safeNext);
}