# STEP 6 Forecast Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학습 데이터만 사용하는 SQL Baseline Forecast와 model/run/version/result 이력을 구현한다.

**Architecture:** DB가 모델 설정, 불변 버전 snapshot, 실행 상태, 결과를 관리한다. Next.js는 ADMIN 실행 API와 analytics 조회 화면만 제공한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase PostgreSQL, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-28-step6-forecast-engine-design.md`

## Global Constraints

- Forecast 계산은 `core.v_train_demand` 또는 그 기반 Grid만 사용한다.
- `raw.usage_history`, `core.v_test_actual`, test 기간 Actual을 Forecast 계산에서 참조하지 않는다.
- 모델 parameters는 DB에서 관리하고 실행 시 snapshot한다.
- UI에서 MA/WMA/sigma/P80/P90을 계산하지 않는다.
- `npm test`와 `npm run build`를 실행한다.

---

### Task 1: Baseline 순수 계약과 SQL 검증

**Files:** Create `lib/forecast/types.ts`, Test `lib/forecast/types.test.ts`, Modify `supabase/tests/step6_forecast_engine.sql`.

- [ ] 모델 코드·Demand Type·Run 상태·결과 계약을 정의한다.
- [ ] MA_3M, MA_6M, WMA_3M, PY_SAME_MONTH, SEASONAL_NAIVE와 3:2:1 가중치의 테스트를 먼저 작성하고 실패를 확인한다.
- [ ] SQL 검증 쿼리로 train view 사용, test view 미사용, 등록 모델과 필수 analytics View를 확인한다.

### Task 2: Forecast DB migration

**Files:** Create `supabase/migrations/20260828000600_step6_forecast_engine.sql`.

- [ ] 기존 `core.forecast_run`을 필요한 컬럼으로 확장하고 model_config/model_version/forecast_result를 생성한다.
- [ ] Baseline 5개를 parameters와 applicable Demand Type 설정과 함께 seed한다.
- [ ] ADMIN 전용 RLS/RPC와 authenticated analytics SELECT 권한을 추가한다.
- [ ] `core.run_baseline_forecast()`에서 snapshot → RUNNING → 결과 → SUCCESS/FAILED를 원자적으로 처리한다.

### Task 3: Server repository/API

**Files:** Create `lib/forecast/repository.ts`, `app/api/forecast/run/route.ts`.

- [ ] `requireAdmin()`을 통과한 요청만 RPC를 호출한다.
- [ ] 오류 시 HTTP 오류와 FAILED run 메시지를 보존한다.

### Task 4: Admin model/run screens

**Files:** Create `app/(admin)/admin/forecast-models/page.tsx`, `app/(admin)/admin/forecast-runs/page.tsx`, `app/(admin)/admin/forecast-runs/run-button.tsx`, Modify `lib/menu.ts`.

- [ ] 모델 설정과 실행 이력을 analytics View로 조회한다.
- [ ] Forecast 실행은 API를 통해서만 수행하고 화면에서는 결과를 재계산하지 않는다.
- [ ] empty/error 상태를 구분한다.

### Task 5: Verification

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] SQL migration 적용 후 `supabase/tests/step6_forecast_engine.sql`을 Supabase SQL Editor에서 실행한다.
