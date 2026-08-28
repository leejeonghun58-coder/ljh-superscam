import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireSupabaseEnv } from './env';
export async function createSupabaseServerClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, { cookies: { getAll() { return cookieStore.getAll(); }, setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Component에서는 middleware가 세션 갱신을 담당합니다. */ } } } });
}