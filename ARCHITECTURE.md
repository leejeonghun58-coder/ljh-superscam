# superSCM 프로젝트 아키텍처

> 작성일: 2026-08-27  
> 대상: 기기·옵션 월간 발주계획 MVP  
> 기준: 현재 저장소의 실제 파일과 `AGENTS.md`, `SCHEMA.md`를 대조한 문서

## 1. 문서 목적

이 문서는 프로젝트를 처음 보는 사람이 **어느 폴더의 어떤 파일을 확인해야 하는지** 빠르게 이해하도록 돕는다. 먼저 전체 구조와 파일별 역할을 요약하고, 뒤에서 화면 실행 흐름·데이터 흐름·폴더별 상세 책임을 설명한다.

현재 저장소는 두 단계가 함께 존재한다.

- Phase 1: 대표 샘플 데이터를 이용해 월간 발주 업무 6단계를 보여주는 로컬 프로토타입
- Phase 2: Supabase `analytics` 뷰를 조회하는 리드타임 분석 예제 화면

따라서 `components/workflow/*`는 대부분 샘플·프리뷰 UI이고, `app/analysis/leadtime/page.tsx`부터 `lib/scm.ts`로 이어지는 분석 경로는 실제 Supabase 조회를 사용하는 구조다.

## 2. 전체 구조 한눈에 보기

```text
superSCM-main/
├─ app/                         Next.js App Router 라우트와 전역 스타일
│  ├─ analysis/                 Supabase 기반 분석 화면 라우트
│  └─ api/                      상태 확인 API 라우트
├─ components/                  화면을 구성하는 React 컴포넌트
│  ├─ analysis/                 분석 화면 공통 껍데기·탭·표
│  └─ workflow/                 월간 발주 업무 6단계 샘플 화면
├─ lib/                         데이터 모델, 조회 함수, Supabase 클라이언트
├─ sql/                         Supabase 권한과 RLS 정책 SQL
├─ supabase/migrations/         데이터베이스 스키마 변경 이력
├─ docs/                        실습 안내와 작업 계획·명세
├─ outputs/                     생성된 Excel과 미리보기 이미지
├─ *.mjs                        샘플 데이터·업무 정의서 생성 스크립트
├─ SCHEMA.md                    Supabase raw/core/analytics 계약 문서
└─ AGENTS.md                    개발 규칙과 구현 순서
```

## 3. 폴더·파일 요약

### 3.1 핵심 애플리케이션 폴더

| 폴더 | 기능 | 주요 파일과 역할 |
|---|---|---|
| `app/` | URL 라우팅, 레이아웃, 전역 스타일 | `layout.tsx`: 루트 레이아웃·메타데이터, `page.tsx`: 메인 진입점, `globals.css`: 전체 스타일 |
| `app/analysis/` | 분석 화면 전용 라우팅 | `layout.tsx`: 분석 공통 헤더·탭, `leadtime/page.tsx`: 리드타임 격차 조회 화면 |
| `app/api/health/supabase/` | Supabase 환경 설정 상태 확인 | `route.ts`: 환경변수 설정 여부를 `GET` JSON으로 반환 |
| `components/` | 화면 표현 계층 | `procurement-app.tsx`: 전체 업무 흐름 상태 관리, 하위 폴더: 분석·워크플로우 UI |
| `components/analysis/` | 분석 화면 재사용 UI | `analysis-frame.tsx`, `analysis-tabs.tsx`, `data-table.tsx` |
| `components/workflow/` | 발주계획 6단계의 샘플 화면 | 대시보드, 수요, 공급, 마스터, 계산, 보고 화면과 공통 하단 네비게이션 |
| `lib/` | 도메인 모델과 외부 데이터 접근 | `scm-model.ts`: 타입·정규화, `scm.ts`: 조회 함수, `supabase/`: 클라이언트 |
| `lib/supabase/` | Supabase 접속 구현 | `env.ts`: 환경변수, `client.ts`: 브라우저 클라이언트, `server.ts`: 서버 클라이언트 |

### 3.2 데이터베이스·문서·생성물 폴더

| 폴더/파일 | 기능 | 파일별 역할 |
|---|---|---|
| `sql/` | Supabase 권한 설정 | `01-grants.sql`: `anon`의 스키마·뷰 읽기 권한, `02-policies.sql`: `core` 쓰기 테이블 RLS 정책 |
| `supabase/migrations/` | Supabase 스키마 변경 이력 | `20260813000100_create_procurement_demand_core.sql`: 수요확정 관련 `planning_runs`, `ol_demand` 등 테이블·제약조건·트리거 생성 |
| `docs/` | 프로젝트 운영·실습 자료 | `04-실습안내.md`: 실습 절차, `superpowers/`: 작업 명세와 계획 보관 |
| `outputs/` | 생성된 외부 산출물 | Excel 업무 정의서, 검사 결과 NDJSON, 시트별 PNG 미리보기 |
| `build_dummy_demand_data.mjs` | 더미 수요 데이터 생성 | 수요확정 예시용 데이터 산출 스크립트 |
| `build_workbook.mjs` | 업무 정의서 Excel 생성 | 프로세스·계산규칙·데이터정의·RACI 등을 포함한 workbook 생성 |

### 3.3 루트 설정·참고 파일

| 파일 | 역할 |
|---|---|
| `AGENTS.md` | 개발 시 지켜야 할 데이터 계층, CSS, 계산, 오류 처리, 검증 규칙 |
| `SCHEMA.md` | Supabase `raw`, `core`, `analytics`의 책임과 뷰 컬럼 계약 |
| `README.md` | 실행법, 현재 Phase, 다음 구현 단계, Supabase 연결 개요 |
| `README_배포전_확인.md` | 수업·배포 전 파일 복사, 권한, 노출 스키마, 빌드 점검 절차 |
| `적용방법.md` | 준비 커밋을 다른 저장소에 적용하는 운영 안내 |
| `2026-08-13-procurement-planning-mvp-prd.md` | 제품 요구사항, 업무 흐름, 계산 규칙, 데이터 모델, 완료 기준 |
| `dump.sql` | Supabase 데이터베이스 덤프/복원용 SQL |
| `.env.example`, `.env.local.example` | Supabase 환경변수 입력 형식 예시 |
| `next.config.ts` | Next.js 설정. 현재 React Strict Mode 활성화 |
| `tsconfig.json` | TypeScript 엄격 모드와 `@/*` 경로 별칭 설정 |
| `vercel.json` | Vercel에서 Next.js 프레임워크로 배포하도록 지정 |
| `package.json` | 의존성과 `dev`, `build`, `start`, `test` 명령 정의 |
| `package-lock.json` | npm 의존성 잠금 파일 |

## 4. 실행 및 라우팅 구조

### 4.1 루트 레이아웃

`app/layout.tsx`는 모든 페이지를 감싸는 서버 레이아웃이다. `app/globals.css`를 전역으로 불러오고, 한국어 문서 언어와 애플리케이션 제목·설명을 메타데이터로 설정한다.

`app/page.tsx`는 별도 로직 없이 `components/procurement-app.tsx`를 렌더링한다. 즉, 메인 업무 화면의 상태와 화면 전환은 라우트가 아니라 클라이언트 컴포넌트 내부 상태로 처리된다.

### 4.2 메인 업무 흐름

```text
GET /
  → app/page.tsx
  → ProcurementApp ('use client')
  → active StepId에 따라 한 단계 렌더링
     dashboard → demand → supply → master → calculation → report
```

`ProcurementApp`은 `active` 상태와 6개 단계 목록을 보유한다. 사이드바와 진행 표시줄은 같은 `steps` 배열을 사용하며, `onNext`, `onBack`, 단계 버튼으로 화면을 바꾼다. 현재 단계·완료 단계·기준월도는 메모리 상태와 하드코딩된 샘플 값으로 표시된다.

### 4.3 분석 화면

```text
GET /analysis/leadtime
  → app/analysis/layout.tsx
     ├─ 분석 홈 링크
     ├─ components/analysis/analysis-tabs.tsx
     └─ page children
  → app/analysis/leadtime/page.tsx
  → lib/scm.ts:getLeadtimeGap()
  → lib/supabase/server.ts
  → analytics.v_leadtime_gap
  → lib/scm-model.ts:normalizeLeadtimeGap()
  → AnalysisFrame + DataTable
```

분석 페이지는 `dynamic = 'force-dynamic'`으로 페이지 캐시를 끄고 매 요청 시 데이터를 조회한다. 조회 오류와 빈 결과를 분리해 표시하도록 설계되어 있다.

## 5. 데이터 계층과 책임

프로젝트의 데이터 계층은 `SCHEMA.md`의 규칙을 따른다.

```text
raw CSV 원본
  → core 정제·매핑·확정 기준
  → analytics 화면용 뷰
  → lib/scm.ts 조회 함수
  → app/analysis/* 화면
```

- `raw`: CSV 원본. 애플리케이션이 직접 수정하거나 화면에서 직접 조회하지 않는다.
- `core`: 공급처 별칭, 확정 리드타임, 사용 프로파일 같은 기준과 정제 뷰를 둔다.
- `analytics`: 화면과 AI가 소비하는 결과 뷰를 둔다. 현재 분석 예제는 `analytics.v_leadtime_gap`을 사용한다.
- 화면: 계산을 수행하지 않고 조회 결과를 표현한다. 새 계산은 SQL 뷰 또는 순수 모델 함수로 분리한다.

현재 구현에서 실제 연결된 조회 경로는 리드타임 분석이다. `getStockoutKpi()`도 준비되어 있지만, 해당 함수와 연결된 재고 소진 화면은 아직 라우트에 구현되지 않았고 분석 탭에서 잠금 상태로 표시된다.

## 6. `app/` 상세

### `app/layout.tsx`

전역 HTML 골격과 메타데이터를 제공한다. 스타일 진입점은 이 파일의 `./globals.css` import다.

### `app/page.tsx`

루트 URL(`/`)의 진입점이다. 실제 UI를 직접 만들지 않고 `ProcurementApp`에 위임하여 라우트와 화면 구현을 분리한다.

### `app/globals.css`

Tailwind나 CSS Module 없이 사용하는 단일 전역 스타일 파일이다. 다음 UI 영역의 클래스를 제공한다.

- 업무 화면: `app-shell`, `sidebar`, `main`, `topbar`, `content`
- 진행·페이지: `progress-*`, `page-heading`, `section`
- 카드·지표: `card`, `metric`, `grid-*`
- 입력·버튼·표: `button`, `form-input`, `table-*`, `table-wrap`
- 분석 화면: `analysis-*`
- 상태 표현: `tag`, `text-good`, `text-danger`, `local-badge`

새 화면에서 스타일이 부족하면 별도 스타일 시스템을 추가하지 말고 이 파일 끝에 공통 클래스를 추가한다.

### `app/analysis/layout.tsx`

`/analysis/*`에만 적용되는 중첩 레이아웃이다. 분석 화면 상단의 발주계획 복귀 링크와 `AnalysisTabs`를 제공한다. 새 분석 페이지는 이 레이아웃의 `children`으로 들어온다.

### `app/analysis/leadtime/page.tsx`

새 분석 화면의 본보기다.

1. `getLeadtimeGap()`으로 서버에서 데이터를 가져온다.
2. 오류가 있으면 오류 카드를 렌더링한다.
3. 정상 응답이면 공급처 수, 실제 리드타임이 더 긴 공급처 수, 표본 부족 수를 표시한다.
4. `DataTable`에 컬럼 정의와 행을 전달한다.
5. `null` 리드타임은 숫자 대신 `—`로 표시하고, 양수 격차는 위험 색상으로 표현한다.

## 7. `components/` 상세

### `components/procurement-app.tsx`

메인 업무 셸이자 클라이언트 상태 관리자다. `StepId` 타입, 단계 메타데이터, 사이드바, 진행 표시줄, 상단바, 단계 렌더링을 한 곳에서 조정한다. 아이콘은 `lucide-react`를 사용하며, 현재 업무 화면에서 분석 화면으로 이동하는 링크도 제공한다.

현재 역할은 업무 플로우 탐색이다. 발주계획 저장, 실제 계산, 인증, 서버 상태 동기화는 아직 연결되어 있지 않다.

### `components/workflow/`

모든 단계 컴포넌트는 `StepFrame`을 사용하고 `onNext`, `onBack` 콜백으로 부모의 단계 이동을 호출한다.

| 파일 | 역할 |
|---|---|
| `step-frame.tsx` | 모든 단계 아래에 이전·다음 버튼과 프로토타입 안내 문구를 제공하는 공통 프레임 |
| `dashboard-step.tsx` | 총 발주금액, 수요·예외·보고 상태, 준비 체크리스트, 발주계획 목록을 샘플 값으로 표시하고 단계 진입을 제공 |
| `demand-step.tsx` | OL, SFDC, Bulk-deal, Trend, 수급회의 탭과 샘플 행 편집·검증·수요 확정 인터랙션 제공. 상태는 컴포넌트 로컬에만 저장 |
| `supply-step.tsx` | 재고·Open PO·운송·통관·검수 구조를 보여주는 공급 단계 프리뷰 |
| `master-step.tsx` | 품목·기종, BOM, 장착율·사용량, MOQ, Lead Time, Flexibility Rule 준비 상태와 체크리스트 표시 |
| `calculation-step.tsx` | 기기·옵션·부품 발주량, 금액, MOQ/Flex 예외 및 수동조정 예정 구조를 샘플 표로 표시 |
| `report-step.tsx` | 전월·전년·OL 대비 보고 지표와 Excel/PDF 출력 예정 영역을 표시 |

워크플로우 컴포넌트의 숫자 계산은 현재 데모를 위한 화면 로컬 계산 또는 샘플 값이다. 운영 계산으로 전환할 때는 `AGENTS.md` 규칙에 따라 SQL/모델/서비스 계층으로 옮겨야 한다.

### `components/analysis/`

| 파일 | 역할 |
|---|---|
| `analysis-frame.tsx` | 분석 페이지 제목·설명·`SUPABASE LIVE` 배지와 본문 영역 제공 |
| `analysis-tabs.tsx` | 분석 화면 목록을 관리한다. `ready: false`이면 404 대신 잠금 탭으로 표시한다 |
| `data-table.tsx` | 타입 매개변수를 받는 범용 분석 표. 컬럼 정렬, 렌더 함수, 빈 결과 문구, 행 키를 지원한다 |

`data-table.tsx`의 `formatNumber`는 표시용 포맷터다. 데이터베이스 집계나 비즈니스 계산을 수행하는 함수가 아니다.

## 8. `lib/` 상세

### `lib/scm-model.ts`

화면이 기대하는 도메인 타입과 원본 행 정규화를 담당한다.

- `LeadtimeGap`: 분석 화면이 사용하는 공급처 리드타임 행 타입
- `value()`: 여러 후보 컬럼명에서 첫 유효값 선택
- `numberValue()`: 숫자 변환 실패 시 `null` 반환
- `normalizeLeadtimeGap()`: Supabase 행을 화면 모델로 변환

컬럼 후보를 여러 개 두는 이유는 뷰·CSV·한글 컬럼명이 달라져도 화면 계약을 유지하기 위해서다. 새 분석 기능도 먼저 이 파일에 타입과 정규화 함수를 추가하는 순서를 따른다.

### `lib/scm.ts`

Supabase 조회를 한 곳에 모은 서버 측 도메인 조회 모듈이다.

- `getLeadtimeGap()`: `analytics.v_leadtime_gap` 전체 조회 후 `LeadtimeGap[]`으로 정규화
- `getStockoutKpi()`: `analytics.v_stockout_kpi` 한 줄 조회. 향후 재고 소진 분석 화면에서 사용하도록 준비됨

두 함수 모두 조회 오류를 `{ rows/data, error }` 형태로 반환하고 예외도 문자열로 변환한다. 화면 컴포넌트가 Supabase를 직접 호출하지 않도록 하는 경계다.

### `lib/supabase.ts`

기존 import 경로를 단순화하는 재-export 파일이다. 브라우저·서버 클라이언트와 환경변수 함수를 `@/lib/supabase`에서 사용할 수 있게 한다.

### `lib/supabase/env.ts`

`NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 읽는다. 값이 없으면 `getSupabaseEnv()`는 `null`을 반환하고, `requireSupabaseEnv()`는 한국어 안내와 함께 예외를 발생시킨다. secret 키는 다루지 않는다.

### `lib/supabase/client.ts`

클라이언트 컴포넌트에서 사용할 Supabase JS 클라이언트를 생성한다. 현재 메인 워크플로우에서 호출되지는 않지만, 향후 브라우저 입력·저장 기능의 접점이다.

### `lib/supabase/server.ts`

서버 컴포넌트·서버 조회 함수에서 사용할 Supabase 클라이언트를 생성한다. 현재 분석 화면 조회에 사용하며, 세션을 쓰지 않는 읽기 중심 구조라 세션 유지·토큰 자동 갱신을 끈다.

## 9. 데이터베이스 파일 상세

### `SCHEMA.md`

데이터베이스의 가장 중요한 계약 문서다. `raw` 원본, `core` 기준·정제, `analytics` 화면 뷰의 역할과 예상 행 수·컬럼을 설명한다. 특히 분석 화면은 `analytics`만 조회하고, Supabase 호출에는 `.schema('analytics')`를 반드시 붙인다는 규칙을 정의한다.

### `supabase/migrations/20260813000100_create_procurement_demand_core.sql`

수요확정 기능의 PostgreSQL 기반 테이블을 마이그레이션으로 생성한다. 계획 실행(`planning_runs`), OL 수요, SFDC 파이프라인, Bulk-deal, 과거 실적, 수요 확정 같은 업무 입력을 데이터베이스에 저장할 기반이다.

### `sql/01-grants.sql`

덤프 복원 후 `anon` 롤이 `analytics`·`core`에 접근할 수 있도록 스키마 및 뷰 읽기 권한을 부여한다. API의 Exposed schemas 설정과는 별개로 필요한 PostgreSQL 권한을 담당한다.

### `sql/02-policies.sql`

RLS가 켜진 `core.leadtime_plan`, `core.usage_profile`에 대한 쓰기 정책을 정의한다. 앱에서 확정 기준을 저장할 때 필요하며, SQL Editor에서만 직접 수정할 계획이면 선택적으로 적용할 수 있다.

### `dump.sql`

Supabase 데이터베이스 복원에 사용하는 대규모 SQL 덤프다. 원본·정제·분석 뷰 구조가 포함될 수 있으므로 수동 수정의 기준이 아니라 복원용 산출물로 취급한다.

## 10. 문서·스크립트·산출물 상세

### `2026-08-13-procurement-planning-mvp-prd.md`

제품 요구사항 문서다. 홈 대시보드부터 수요 확정, 재고·Open PO, 마스터, 발주량 계산, 예외 검토, 보고서까지의 목표 업무와 계산 규칙·데이터 모델·향후 Supabase 전환 방향을 정의한다.

### `docs/04-실습안내.md`

현재 4회차 실습의 진행 순서와 확인 항목을 설명한다. 분석 화면 구현 전후에 어떤 데이터 건수와 URL을 확인할지 참고하는 운영 문서다.

### `docs/superpowers/specs/` 및 `docs/superpowers/plans/`

작업 명세와 구현 계획을 보관한다. 제품 요구사항과 실제 코드의 차이를 이해하거나 과거 작업 의도를 추적할 때 참고한다.

### `build_dummy_demand_data.mjs`

수요 입력·확정 흐름을 테스트하거나 시연하기 위한 더미 데이터 생성 스크립트다. 생성된 데이터는 애플리케이션의 영구 저장소가 아니다.

### `build_workbook.mjs`

월간 발주 프로세스 정의서를 Excel workbook으로 만드는 스크립트다. `outputs/` 아래의 Excel과 PNG 미리보기는 이 계열 작업의 결과물이다.

### `outputs/`

소스 코드가 아닌 생성 결과를 보관하는 폴더다. 결과물을 수정해 애플리케이션 로직을 바꾸는 곳이 아니며, 원본 생성 스크립트와 문서를 먼저 확인해야 한다.

## 11. 환경변수·보안·배포 경계

- 로컬 비밀값은 `.env.local`에만 둔다.
- 클라이언트에 노출 가능한 Supabase publishable key만 사용한다.
- `sb_secret_*` 키는 클라이언트 코드와 `NEXT_PUBLIC_*` 변수에 넣지 않는다.
- Supabase의 `core`, `analytics`는 API Exposed schemas에 등록되어야 한다.
- Exposed schemas는 라우팅 설정이고, `sql/01-grants.sql`의 PostgreSQL 권한 부여와는 별개다.
- `vercel.json`은 Vercel 배포 대상을 Next.js로 지정한다.

환경변수 상태만 확인하려면 다음 경로를 사용한다.

```text
GET /api/health/supabase
  configured: false → 환경변수 없음, HTTP 503
  configured: true  → 환경변수 형식 확인, HTTP 200
```

이 API는 실제 데이터베이스 연결이나 권한까지 검증하지 않는다. 실제 분석 조회가 실패하면 Exposed schemas, GRANT, 뷰 존재 여부를 함께 확인해야 한다.

## 12. 새 분석 화면을 추가하는 표준 순서

새 분석 기능은 다음 경계를 유지해야 한다.

1. `lib/scm-model.ts`에 타입과 컬럼 후보를 포함한 정규화 함수 추가
2. `lib/scm.ts`에 `analytics` 뷰 조회 함수 추가
3. `app/analysis/<기능이름>/page.tsx`에 서버 페이지 추가
4. `components/analysis/*`의 공통 프레임·탭·표 재사용
5. `components/analysis/analysis-tabs.tsx`에서 준비된 탭으로 등록
6. `npm run build`로 라우트와 TypeScript 빌드 확인

새 화면에서 직접 Supabase를 호출하거나 화면 JSX 안에 평균·분위수 같은 업무 계산을 넣지 않는다. 계산은 SQL 뷰 또는 순수 모델 함수에 둔다.

## 13. 현재 상태와 향후 확장 지점

현재 메인 `/`은 샘플 UI 중심이며, 실제 저장·업로드·계산·보고서 생성은 아직 Phase 2 이후 작업으로 남아 있다. 반면 `/analysis/leadtime`은 Supabase `analytics.v_leadtime_gap` 조회가 연결된 첫 분석 경로다.

향후 구현 시 다음 순서를 권장한다.

```text
analytics/core 뷰·테이블 확정
  → scm-model 타입·정규화
  → scm.ts 조회/저장 함수
  → analysis 페이지 또는 workflow 단계 연결
  → 입력·검증·계산·보고서 기능 활성화
```

특히 `components/workflow/*`에 남아 있는 샘플 수치와 로컬 상태를 실제 데이터로 교체할 때는, 화면에 계산식을 옮기지 말고 데이터베이스 뷰·도메인 모델·조회 계층을 먼저 확정해야 한다.

## 14. 검증 체크리스트

변경 후에는 다음을 확인한다.

- `npm run build`가 통과하는가
- `/`에서 6단계 이동이 정상인가
- `/analysis/leadtime`에서 Supabase 오류와 빈 결과가 구분되는가
- 분석 표의 행 수가 `analytics.v_leadtime_gap` 조회 결과와 같은가
- `null` 값이 임의의 숫자로 표시되지 않는가
- `.schema('analytics')`를 빼먹은 조회가 없는가
- 화면 컴포넌트가 Supabase를 직접 호출하지 않는가
- 새 계산이 JSX 안에 들어가지 않았는가
- 환경변수와 secret key가 커밋 대상에 포함되지 않았는가

