# 오류 기록

## 2026-08-27 — `Invalid schema: analytics`

### 증상

`/analysis/leadtime`에서 다음 오류가 표시됨.

```text
조회에 실패했습니다.
Invalid schema: analytics
```

### 확인 결과

- `app/analysis/leadtime/page.tsx`와 `lib/scm.ts`는 올바르게 `.schema('analytics')`를 사용하고 있음.
- `.env.local`의 Supabase URL은 `https://<project-ref>.supabase.co` 형식이고 publishable key도 설정되어 있음.
- 저장소의 `dump.sql`에는 `analytics` 스키마와 `analytics.v_leadtime_gap` 뷰 정의가 있음.
- 따라서 앱 코드보다는 **앱이 연결된 Supabase 프로젝트의 Data API 스키마 노출 상태, 실제 스키마 존재 여부, 또는 PostgREST 설정 캐시**를 확인해야 함.
- 대시보드에서 체크했는데도 계속 발생하면 현재 `.env.local`의 프로젝트가 설정을 변경한 Supabase 프로젝트와 같은지 확인해야 함.

### 해결 순서

1. Supabase Dashboard에서 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`과 같은 프로젝트를 연다.
2. **Project Settings → API → Data API → Exposed schemas**에서 `analytics`와 `core`를 체크한다.
3. **Save**를 눌러 변경사항을 저장한다. `public`도 기존 선택값이면 유지한다.
4. SQL Editor에서 스키마와 뷰 존재 여부를 확인한다.

```sql
select schema_name
from information_schema.schemata
where schema_name in ('analytics', 'core', 'raw');

select table_schema, table_name
from information_schema.views
where table_schema = 'analytics'
  and table_name = 'v_leadtime_gap';
```

5. `analytics` 또는 `v_leadtime_gap`이 없으면 저장소의 `dump.sql`을 해당 프로젝트에 복원한다.
6. 복원 후 `sql/01-grants.sql`을 실행해 `anon`·`authenticated`의 읽기 권한을 부여한다.
7. 개발 서버를 완전히 중지한 뒤 다시 실행한다.

```bash
npm run dev
```

### 코드 보완

`lib/scm-model.ts`에 오류 메시지 변환을 추가했고, `lib/scm.ts`가 `Invalid schema: analytics`를 감지하면 위 대시보드 설정과 `dump.sql` 복원 안내를 화면에 함께 표시하도록 했다. 이 변경은 Supabase의 원격 설정을 대신 바꾸지는 않지만, 같은 오류가 발생했을 때 원인과 조치를 바로 확인할 수 있게 한다.

### 참고

Data API의 Exposed schemas 설정과 PostgreSQL 권한은 서로 다르다. 노출 설정 후에도 `permission denied for schema analytics`가 나오면 `sql/01-grants.sql`을 실행해야 한다. `Invalid schema: analytics`는 권한 오류보다 앞 단계인 스키마 노출/존재/캐시 문제다.

## 최종 확인 — 개발 서버 네트워크 실행 환경

대시보드 설정을 확인한 뒤에도 화면에서 `TypeError: fetch failed`가 표시되었다. 개발 서버가 샌드박스 네트워크 환경에서 실행되어 외부 Supabase API 요청이 차단된 것이 최종 원인이었다.

기존 개발 서버를 종료하고 네트워크 연결이 가능한 환경에서 다시 실행한 뒤 `/analysis/leadtime`을 새로고침하자 공급처 12행이 정상 표시되었다.

```bash
npm run dev -- --port 3001
```

화면에 `Invalid schema: analytics`가 계속 표시되는 경우에는 이 항목보다 먼저 Exposed schemas, 스키마·뷰 존재 여부, 프로젝트 URL 일치 여부를 확인한다. 화면에 `TypeError: fetch failed`가 표시되면 개발 서버의 외부 네트워크 접근 권한과 Supabase URL 접속 가능성을 확인한다.

## 2026-08-27 — Vercel 배포에서 `Invalid schema: analytics`

### 증상

로컬에서는 `/analysis/leadtime`이 정상적으로 12개 공급처를 표시하지만, Vercel 배포본에서는 다음 오류가 표시됨.

```text
조회에 실패했습니다.
Invalid schema: analytics
```

### 원인

Vercel은 로컬 `.env.local`을 사용하지 않는다. Vercel Project Settings에 등록된 `NEXT_PUBLIC_SUPABASE_URL`이 가리키는 Supabase 프로젝트에서 `analytics`가 Data API에 노출되어 있지 않거나, 로컬과 다른 Supabase 프로젝트를 가리키고 있는 상태다.

환경변수가 완전히 없었다면 `lib/supabase/env.ts`의 환경변수 오류가 먼저 발생하므로, 이번 메시지는 환경변수는 읽혔지만 해당 Supabase API에서 `analytics` 스키마를 허용하지 않는 경우에 해당한다.

### 해결 순서

1. Vercel Project → **Settings → Environment Variables**에서 Production의 `NEXT_PUBLIC_SUPABASE_URL` 프로젝트 ref를 확인한다.
2. 로컬 `.env.local`의 URL과 같은 Supabase 프로젝트인지 비교한다.
3. 그 Supabase 프로젝트의 **Project Settings → API → Data API → Exposed schemas**에서 `analytics`, `core`, `public`을 체크하고 Save한다.
4. SQL Editor에서 `analytics.v_leadtime_gap` 뷰가 실제로 존재하는지 확인한다.
5. Vercel에서 **Redeploy**한다. 환경변수와 Data API 설정은 기존 배포에 자동으로 재반영되지 않을 수 있다.

```sql
select schema_name
from information_schema.schemata
where schema_name in ('analytics', 'core', 'raw');

select table_schema, table_name
from information_schema.views
where table_schema = 'analytics'
  and table_name = 'v_leadtime_gap';
```

### 추가 확인

스키마 노출 후 `permission denied for schema analytics`가 나오면 `sql/01-grants.sql`을 해당 Supabase 프로젝트에서 실행한다. Vercel에 환경변수를 새로 등록하거나 수정한 경우에도 반드시 새 배포가 필요하다.

## 2026-08-27 — 로컬에서 `.env.local` 누락 메시지 표시

### 확인 결과

현재 저장소의 `.env.local`에는 다음 두 변수가 모두 설정되어 있다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

네트워크 권한으로 실행된 `http://localhost:3001`에서는 리드타임 12행이 정상 조회되었다. 동시에 3000 포트와 3001 포트에 서로 다른 Node 개발 서버가 실행 중인 것이 확인되었다.

### 원인

화면이 `env.ts`의 누락 메시지를 표시한다면 `.env.local`을 읽지 못한 다른 개발 서버(오래된 3000 포트 프로세스)에 접속했거나, 환경변수 파일 변경 전에 시작된 서버를 보고 있는 경우다.

### 해결

현재 프로젝트 서버는 다음 주소로 접속한다.

```text
http://localhost:3001/analysis/leadtime
```

환경변수를 변경한 뒤에는 개발 서버를 완전히 종료하고 프로젝트 루트에서 다시 실행한다.
## 2026-08-28 — 터미널 런타임 초기화 실패

### 증상

Codex의 일반 `exec_command` 실행 시 다음 오류가 발생함.

```text
Failed to create unified exec process: helper_unknown_error: setup refresh had errors
```

### 해결

권한이 필요한 독립 PowerShell 실행으로 프로젝트 접근을 복구했다. 일반 샌드박스 실행은 계속 실패했지만, 독립 실행에서는 프로젝트 확인·수정·테스트가 정상 동작했다.
## 2026-08-28 — 로그인 후 다시 로그인 화면으로 돌아감

### 증상

이메일과 비밀번호를 입력해도 로그인 화면을 벗어나지 못함.

### 원인 후보

STEP 2 migration은 GitHub에 push되었지만 Supabase 프로젝트에 자동 적용되지 않습니다. `core.app_user` 테이블/`auth.users` 생성 trigger가 적용되지 않았거나, migration 적용 전에 이미 만들어진 Auth 사용자에게 `core.app_user` 행이 없으면 `signInWithPassword` 이후 `requireUser()`가 프로필을 찾지 못해 `/login?error=inactive`로 되돌립니다. 로그인 action은 `record_login()` 오류를 현재 무시하므로 실제 DB 미적용 원인이 화면에 드러나지 않습니다.

### 해결

1. Supabase SQL Editor에서 `supabase/migrations/20260828000200_step2_auth_rbac.sql`을 실행한다.
2. migration 전에 만들어진 사용자 프로필을 보정한다.

```sql
insert into core.app_user (user_id, email, name)
select id, email, coalesce(raw_user_meta_data ->> 'name', raw_user_meta_data ->> 'full_name')
from auth.users u
where not exists (select 1 from core.app_user p where p.user_id = u.id);
```

3. 최초 관리자 계정을 지정한다.

```sql
update core.app_user set role = 'ADMIN' where email = '관리자 이메일';
```

4. 로컬에서 테스트한다면 개발 서버를 실행한다.

```bash
npm run dev -- --port 3001
```

5. `/login`에서 다시 로그인한다.
## 2026-08-28 — 재고 소진 위험 전체 품목 `NO_USAGE`

### 증상

`/analysis/stockout`에서 분석 품목 20개가 모두 `— + NO_USAGE`로 표시되고, 소진 위험·안전·30일 이내 소진 KPI가 모두 0으로 표시됨.

### 원인

STEP 3 migration의 `core.forecast_setting` 기본 행은 생성되지만 `train_start`, `train_end`, `test_start`, `test_end`가 모두 `NULL`인 상태임.

`core.v_train_demand`는 다음 조건을 요구하므로 날짜 설정이 없으면 0행을 반환함.

```sql
s.train_start is not null
and s.train_end is not null
and u.use_date between s.train_start and s.train_end
```

이후 `core.v_usage_effective`가 빈 학습 뷰를 집계하고, `analytics.v_stockout_risk`의 사용량 조인이 모든 품목에서 `NULL`이 됨. 화면의 `NO_USAGE` 표시는 이 계산 불가 상태를 숫자 0으로 숨기지 않은 정상 표시임.

### 확인 쿼리

```sql
select * from core.forecast_setting where setting_id = 'default';
select count(*) from core.v_train_demand;
select count(*) from core.v_test_actual;
select * from analytics.v_data_coverage;
```

### 해결

관리자 권한으로 `/admin/forecast-settings`에서 학습·검증 기간을 실제 데이터 범위 안에 설정해야 함. 저장 후 `/analysis/stockout`을 새로고침함.

현재 dump 기준 데이터 범위는 `2025-03-03`부터 `2026-08-21`까지이며, 실제 운영 기준에 맞는 train/test 경계를 먼저 결정해야 함. 앱 코드에 날짜를 하드코딩하거나 계산 불가 값을 0으로 바꾸면 안 됨.
## 2026-08-28 — STEP 4 SQL migration 작성 중 문법 오타

### 증상

신규 import migration의 함수 선언 앞에 불필요한 `a` 문자가 들어간 것을 자체 검토에서 발견함.

### 해결

원격 Supabase에 적용하기 전에 `create or replace function`으로 수정했다. SQL migration은 원격 적용 전 문자열 검토와 SQL Editor 실행 결과를 함께 확인한다.
## 2026-08-28 — STEP 4 타입 점검에서 기존 정규식 target 오류

### 증상

`npx tsc --noEmit` 실행 시 `lib/scm-model.test.ts(60,44)`에서 정규식 플래그가 `es2018` 이상을 요구한다는 오류가 발생함.

### 확인 결과

STEP 4 파일과 무관하게 기존 테스트 코드가 `tsconfig.json`의 `target: es5`와 충돌하는 상태임. Next.js production build의 별도 타입 검사 결과로 앱 영향 여부를 확인하고, 기존 테스트 파일/target 설정은 범위를 넓히지 않기 위해 보류함.

## 2026-08-28 STEP 4 테스트 중복 import 오류

- 증상: `parse.test.ts`, `validate.test.ts`에 테스트를 추가하는 과정에서 import 블록이 중복되어 `Identifier 'test' has already been declared`가 발생했다.
- 원인: 기존 테스트 파일 하단에 새 테스트와 import를 append했다.
- 해결: 각 테스트 파일의 import를 파일 상단의 단일 블록으로 통합하고 전체 테스트를 다시 구성했다.
- 결과: `npm test` 24개 통과.

## 2026-08-28 — STEP 4 Data Management 진입 시 서버 예외 digest

- 증상: Vercel에서 `/admin/data-management` 선택 시 `Application error: a server-side exception has occurred`와 digest가 표시됨.
- 원인: Sidebar가 USER에게도 ADMIN 메뉴를 노출했고, USER 접근 시 `requireAdmin()`이 호출하는 Next.js `forbidden()`이 `experimental.authInterrupts` 비활성 상태에서 실행되어 정상 403 대신 예외로 처리됨.
- 해결: `next.config.ts`에 `experimental.authInterrupts: true`를 활성화하고 `app/forbidden.tsx` 403 경계 화면을 추가했다. `getMenuForRole()`을 통해 ADMIN 메뉴는 ADMIN에게만 노출한다. 서버의 `requireAdmin()` 및 DB RLS 검증은 그대로 유지한다.

## 2026-08-28 — 권한 처리 수정 후 Next 설정 구문 오류

- 증상: `npm run build`에서 `next.config.ts`의 `Expected unicode escape` 오류 발생.
- 원인: PowerShell 문자열 치환 시 줄바꿈이 실제 개행이 아니라 리터럴 `\n`으로 저장됨.
- 해결: `next.config.ts`를 정상 개행 형식으로 다시 저장했다.

## 2026-08-28 — 권한 메뉴 수정 후 Sidebar 구문 오류

- 증상: `npm run build`에서 `sidebar.tsx`의 `Expected unicode escape` 오류 발생.
- 원인: 문자열 치환 중 import 사이의 줄바꿈이 리터럴 `\n`으로 기록됨.
- 해결: `sidebar.tsx`를 정상 개행 형식으로 재작성했다.

## 2026-08-28 — STEP 4 메뉴가 보이지 않음

- 증상: ADMIN 사용자가 로그인해도 Sidebar에 STEP 4 `Data Management` 메뉴가 표시되지 않음.
- 원인: `AppShell`이 기본 `role='USER'`로 동작하는데 `app/(admin)/layout.tsx`가 `role='ADMIN'`을 전달하지 않음.
- 해결: 관리자 layout에서 `<AppShell role="ADMIN">`을 사용하도록 수정했다. USER의 ADMIN 메뉴 숨김 동작은 유지한다.

## 2026-08-28 — role 전달 수정 중 PowerShell 인용 오류

- 증상: layout 수정 명령에서 `Missing ')' in method call` 구문 오류가 발생해 첫 번째 수정 시도는 실행되지 않음.
- 원인: PowerShell 문자열 안의 JSX 큰따옴표를 잘못 escape함.
- 해결: 작은따옴표 기반 문자열 치환으로 다시 실행했고, 메인·분석·USER layout에 실제 role 전달을 정상 반영함.

## 2026-08-28 — 신규 ID ADMIN 지정 후 로그인 실패

- 원인: Supabase Auth의 `auth.users` 인증 계정과 애플리케이션 권한 프로필 `core.app_user`는 별개다. 신규 Auth 사용자에 `core.app_user` 행이 없거나 `active = false`이면 `requireUser()`가 로그인 직후 비활성 사용자로 처리한다.
- 추가 확인: `core.handle_new_auth_user` trigger가 실제 Supabase 프로젝트에 적용되어 있어야 신규 Auth 사용자 생성 시 프로필이 자동 생성된다. 저장소 migration을 push하는 것만으로 원격 DB에 trigger가 적용되지는 않는다.
- 확인 쿼리: `auth.users`와 `core.app_user`를 `user_id`로 조인해 이메일, role, active를 확인한다.

## 2026-08-28 — `at89c2@naver.com` 로그인 성공 후 ADMIN 메뉴 미표시

- 확인: 제공된 화면에서 로그인은 성공했으므로 Supabase Auth 이메일/비밀번호 인증은 정상이다.
- 증상: ADMIN 메뉴가 보이지 않으므로 현재 세션의 `core.app_user` role이 `USER`이거나 해당 프로필이 ADMIN으로 갱신되지 않은 상태로 판단된다.
- 조치: `auth.users`와 `core.app_user`를 user_id로 조인해 해당 이메일의 role/active를 확인하고, 필요한 경우 role을 ADMIN으로 갱신한다.

## 2026-08-28 — SQL Editor에서 신규 ADMIN profile upsert 실패

- 증상: `core.app_user` upsert 실행 시 `관리자만 사용자를 변경할 수 있습니다`가 발생함.
- 원인: `on conflict do update`가 `app_user_update_guard()` trigger를 실행하지만 SQL Editor 요청에는 애플리케이션 로그인 세션의 `auth.uid()`가 없어 `core.is_admin()`이 false가 됨.
- 해결: 기존 활성 ADMIN 사용자의 UUID를 확인한 뒤 SQL Editor의 임시 request JWT claims에 해당 UUID를 설정하고 upsert한다. 이때도 DB trigger와 RLS 검사는 유지된다.
