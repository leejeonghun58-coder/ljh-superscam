import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { getSupabaseEnv } from '@/lib/supabase/env';

const protectedPrefixes = ['/', '/dashboard', '/analysis', '/admin', '/workflow'];
const publicPaths = ['/login'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => prefix === '/' ? pathname === '/' : pathname.startsWith(prefix));
  if (!isProtected || publicPaths.includes(pathname)) return NextResponse.next();
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.publishableKey, { cookies: { getAll: () => request.cookies.getAll(), setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) { cookiesToSet.forEach(({ name, value, options }) => { request.cookies.set(name, value); response = NextResponse.next({ request }); response.cookies.set(name, value, options); }); } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { const loginUrl = new URL('/login', request.url); loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`); return NextResponse.redirect(loginUrl); }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'] };