# STEP 2 인증·Role·RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Supabase Auth, Next.js SSR session, middleware, server helpers, 관리자 사용자 관리, audit log, RLS를 연결해 ADMIN과 USER 권한을 세 계층에서 강제한다.

**Architecture:** `auth.users` 생성 trigger가 `core.app_user`를 만들고, cookie 기반 SSR client가 현재 세션을 서버로 전달한다. middleware는 경로를 빠르게 보호하고, `lib/auth.ts`는 실제 server action/route handler의 권한을 판정하며, Supabase RLS가 최종 차단선이 된다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase SSR, PostgreSQL RLS, Node test runner

**Spec:** `docs/superpowers/specs/2026-08-28-step2-auth-rbac-design.md`

## Global Constraints

- raw 데이터는 직접 수정하지 않는다.
- 계산 SQL과 analytics 조회 로직은 변경하지 않는다.
- secret/service role key는 브라우저에 노출하지 않는다.
- 화면 문구와 주석은 한국어로 작성한다.
- 권한은 메뉴 숨김만으로 보호하지 않는다.

---

### Task 1: DB schema와 RLS

**Files:**
- Create: `supabase/migrations/20260828000200_step2_auth_rbac.sql`
- Modify: `sql/01-grants.sql`
- Modify: `sql/02-policies.sql`

- [ ] `core.app_user`, `core.audit_log`, trigger, `core.is_admin()`을 만든다.
- [ ] anon write와 `using(true)` 업무 mutation 정책을 제거한다.
- [ ] authenticated 읽기 및 ADMIN mutation 정책을 작성한다.
- [ ] 자기 자신 role/active 변경 금지 정책을 작성한다.

### Task 2: SSR session과 auth helper

**Files:**
- Modify: `lib/supabase/server.ts`
- Create: `lib/auth.ts`
- Create: `lib/auth.test.ts`

- [ ] cookie adapter 기반 server client를 구현한다.
- [ ] `getRole`, `requireUser`, `requireAdmin`을 구현한다.
- [ ] 비활성 사용자와 role 누락을 거부한다.
- [ ] helper의 순수 판정 부분을 테스트한다.

### Task 3: middleware와 서버 경로

**Files:**
- Create: `middleware.ts`
- Modify: `lib/menu.ts`
- Modify: `app/(admin)/layout.tsx`

- [ ] 보호 경로와 로그인 경로를 정의한다.
- [ ] 미로그인 보호 경로를 login next로 redirect한다.
- [ ] admin layout은 서버에서 `requireAdmin`을 호출한다.

### Task 4: 로그인과 로그아웃

**Files:**
- Create: `app/(auth)/login/actions.ts`
- Modify: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/logout/route.ts`

- [ ] password 로그인 Server Action을 만든다.
- [ ] 실패 메시지와 next 복귀를 구현한다.
- [ ] 로그아웃 시 세션을 폐기하고 login으로 이동한다.

### Task 5: 관리자 사용자 관리

**Files:**
- Create: `app/(admin)/admin/users/actions.ts`
- Create: `app/(admin)/admin/users/page.tsx`

- [ ] ADMIN만 action을 실행하도록 첫 줄에서 requireAdmin을 호출한다.
- [ ] role/active 변경 전후를 audit log에 기록한다.
- [ ] 자기 자신의 role/active 변경을 거부한다.

### Task 6: 검증

**Files:**
- Modify: `lib/auth.test.ts`
- Create: `supabase/tests/step2_rls.sql`

- [ ] npm test를 실행한다.
- [ ] npm run build를 실행한다.
- [ ] SQL 검증 쿼리로 anon write 거부와 관리자 정책을 확인한다.
