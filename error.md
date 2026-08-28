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