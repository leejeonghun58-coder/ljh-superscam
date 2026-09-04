# STEP 7·8 Backtest and Python Forecast Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete SQL Backtest/Champion/Model Comparison and add a separate FastAPI forecast service that preserves STEP 6 run/model-version/result contracts.

**Architecture:** STEP 7 scores only stored `core.forecast_result` against `core.v_test_actual` in PostgreSQL, persisting immutable backtest, performance, and champion-selection records. STEP 8 adds a separate Python service with a common model interface and writes through a controlled integration endpoint without changing existing SQL forecast reads.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase PostgreSQL migrations/RLS, Python 3 FastAPI, pandas, optional model adapters.

**Spec:** `C:/Users/fujifilm/.codex/attachments/45125574-bb82-4ab0-8c7f-10c88804d296/pasted-text.txt`

## Global Constraints

- Backtest uses stored Forecast Result plus `core.v_test_actual`; it never reruns Forecast or reads `raw.usage_history` directly.
- SQL performs WAPE, MAPE, Bias, RMSE, MAE, baseline improvement, and ranking.
- Null/calculation-unavailable values remain null with a reason code.
- Bias is `forecast - actual`; positive means over-forecast.
- USER may read permitted analytics results; ADMIN alone may run Backtest, change settings, and select Champion.
- Python service is separate from Next.js and never trains on test Actual.
- `run_id` and `model_version` are required for every stored forecast result.

---

### Task 1: Consolidate and harden STEP 7 database objects

**Files:**
- Modify: `supabase/migrations/20260828000700_step7_backtest_champion.sql`
- Review: `supabase/migrations/20260828000600_step7_backtest_champion.sql`
- Test: `lib/step7-sql.test.ts`, `lib/backtest-policy.test.ts`

- [ ] Remove duplicate/conflicting STEP 7 migration behavior while preserving existing migration history.
- [ ] Ensure performance scoring joins stored Forecast Result to `core.v_test_actual`, preserves missing rows, and writes explicit reason codes.
- [ ] Ensure rank uses configured metric ascending with absolute Bias, RMSE, and model_id tie-breaks.
- [ ] Ensure no Champion row is created when no valid candidate exists.
- [ ] Ensure manual Champion selection requires a nonblank reason and appends audit history.
- [ ] Add/adjust SQL contract tests for data source, metric formulas, null handling, and RBAC.

### Task 2: Complete STEP 7 analytics access and Model Comparison

**Files:**
- Modify: `lib/backtest/repository.ts`, `lib/backtest/types.ts`, `lib/scm.ts`
- Modify: `app/analysis/model-comparison/page.tsx`, `app/analysis/model-comparison/comparison-view.tsx`
- Modify: `components/chart/forecast-overlay-chart.tsx`
- Test: `lib/demand-profile-model.test.ts`, `lib/backtest-policy.test.ts`

- [ ] Query only analytics views from server-side repository code.
- [ ] Render stored metrics, stored forecast detail, prediction intervals, and Champion status.
- [ ] Keep model toggles/filter/export client-side only; never invoke forecast/backtest execution from the comparison screen.
- [ ] Preserve EmptyValue for null metrics and common Badge/status conventions.

### Task 3: Add STEP 7 execution/admin regression coverage

**Files:**
- Modify: `app/(admin)/admin/backtest-runs/actions.ts`, `app/(admin)/admin/champion-models/actions.ts`
- Create/Modify: `lib/step7-runtime.test.ts`

- [ ] Test exact RPC names and required manual reason behavior.
- [ ] Test model ranking and Champion candidate persistence using deterministic SQL fixtures/contracts.
- [ ] Test that changing model toggles does not call execution endpoints.

### Task 4: Scaffold separate Python forecast service

**Files:**
- Create: `services/forecast_service/pyproject.toml`
- Create: `services/forecast_service/app/main.py`
- Create: `services/forecast_service/app/contracts.py`
- Create: `services/forecast_service/app/engine.py`
- Create: `services/forecast_service/app/models/base.py`
- Create: `services/forecast_service/app/models/baseline.py`
- Create: `services/forecast_service/tests/test_engine.py`

- [ ] Define `forecast(train_df, horizon, params) -> DataFrame` and a registry-driven model adapter interface.
- [ ] Implement deterministic Exponential Smoothing/Holt/Holt-Winters/SARIMA/Croston/SBA/TSB adapters with clear optional dependency behavior.
- [ ] Reject test Actual input and insufficient history instead of fabricating values.
- [ ] Expose `GET /health`, `GET /models`, `POST /forecast/run`, and `POST /backtest/run` contracts.

### Task 5: Connect Python results without breaking SQL pipeline

**Files:**
- Modify: `supabase/migrations/20260828000800_step8_python_forecast.sql`
- Modify: `app/api/forecast/python/run/route.ts`
- Create/Modify: `services/forecast_service/app/storage.py`
- Test: `lib/forecast-data-contract.test.ts`, Python service tests

- [ ] Preserve model version/parameter snapshots and `forecast_run` lifecycle.
- [ ] Persist Python output into the same `core.forecast_result` contract.
- [ ] Mark failures as FAILED with a message and keep prior stored results readable.
- [ ] Ensure STEP 7 views automatically include Python model performance after a Backtest run.

### Task 6: Full verification and documentation

**Files:**
- Modify: `error.md` when errors occur.
- Modify: `README.md` or service README with local run commands.

- [ ] Run targeted TypeScript and Python tests.
- [ ] Run `npm test` and `npm run build`.
- [ ] Run SQL migration/contract checks and verify exposed-schema/RLS grants.
- [ ] Confirm no direct raw usage query exists in Forecast/Backtest execution paths.

---