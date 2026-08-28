# STEP 4 데이터 적재 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV/XLSX를 서버에서 staging·검증·승인한 뒤에만 raw에 저장하고, batch 이력·오류 CSV·rollback·Forecast stale을 제공한다.

**Architecture:** ADMIN 전용 Route Handler가 파일을 서버에서 파싱하고 `core.import_staging`에 원본 JSONB를 저장한다. 단일 validation 모듈이 mapping된 행을 검사하고, DB의 `core.import_batch`/`core.rollback_batch` SECURITY DEFINER 함수가 승인 상태·ADMIN·batch_id를 재검증한 후 raw 대상 테이블에만 기록한다. 기존 raw 계산 뷰와 STEP 3 train/test 경계는 수정하지 않는다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase SSR, PostgreSQL RLS/SECURITY DEFINER, PapaParse, xlsx, 순수 CSS.

**Spec:** `docs/superpowers/specs/2026-08-28-step4-import-pipeline-design.md`

## Global Constraints

- `AGENTS.md`와 `SCHEMA.md`의 raw/core/analytics 규칙을 따른다.
- CSV와 XLSX parsing/validation은 서버에서 수행한다.
- 사용자가 확인하기 전에는 raw에 직접 저장하지 않는다.
- 계산 불가·오류 값을 보정하거나 null을 0으로 바꾸지 않는다.
- 지원 Import Type은 실제 raw 테이블에 존재하는 8개로 제한한다.
- 모든 raw import 행은 `batch_id`, `source_type = 'FILE_UPLOAD'`, `loaded_at`, `source_record_id`를 가진다.
- anon과 USER는 upload/staging/validation/import/rollback을 실행할 수 없다.
- replace는 2단계 확인을 요구하고 rollback 불가를 표시한다.
- 화면 컴포넌트에는 validation·정제·계산 로직을 넣지 않는다.
- 각 작업 후 `npm test`와 필요한 단위 테스트를 실행하고, 마지막에 `npm run build`를 실행한다.

---

### Task 1: 의존성 및 Import 계약

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `lib/import/types.ts`
- Create: `lib/import/schema.ts`
- Test: `lib/import/schema.test.ts`

**Interfaces:**
- `ImportType = 'usage_history' | 'inventory' | 'item_master' | 'supplier_master' | 'purchase_order' | 'goods_receipt' | 'sales_order' | 'business_event'`
- `ImportMode = 'append' | 'upsert' | 'replace'`
- `getImportSchema(type): ImportSchema`
- `suggestColumnMapping(type, headers): ColumnMapping[]`

- [ ] **Step 1: Write the failing test**

```ts
test('지원 import type은 실제 raw 테이블 8개로 제한한다', () => {
  assert.deepEqual(Object.keys(IMPORT_SCHEMAS).sort(), [
    'business_event', 'goods_receipt', 'inventory', 'item_master',
    'purchase_order', 'sales_order', 'supplier_master', 'usage_history',
  ]);
});

test('한국어 alias에서 usage_history 표준 컬럼을 추정한다', () => {
  assert.deepEqual(suggestColumnMapping('usage_history', ['품목코드', '출고일', '출고수량']).map((x) => x.targetColumn), ['item_id', 'use_date', 'qty']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/import/schema.test.ts`
Expected: FAIL because `lib/import/schema.ts` and its exports do not exist.

- [ ] **Step 3: Write minimal implementation**

Add the exact eight schemas, target table names, required fields, natural keys, numeric/date fields, and Korean/English aliases. Add `papaparse` and `xlsx` as dependencies without adding a CSS framework.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/import/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/import/types.ts lib/import/schema.ts lib/import/schema.test.ts
git commit -m "STEP 4 import 타입과 컬럼 계약 추가"
```

### Task 2: 서버 Parser

**Files:**
- Create: `lib/import/parse.ts`
- Test: `lib/import/parse.test.ts`

**Interfaces:**
- `parseImportFile(file: File, type: ImportType): Promise<ParsedImport>`
- `ParsedImport = { headers: string[]; rows: ParsedRow[]; sourceFormat: 'CSV' | 'XLSX' }`

- [ ] **Step 1: Write the failing tests**

```ts
test('CSV 원본값과 행 번호를 보존한다', async () => {
  const result = await parseImportFile(new File(['품목코드,출고일,출고수량\nITEM001,2026-08-01,12'], 'sample.csv'), 'usage_history');
  assert.deepEqual(result.rows[0], { rowNumber: 2, values: { 품목코드: 'ITEM001', 출고일: '2026-08-01', 출고수량: '12' } });
});

test('지원하지 않는 확장자는 거부한다', async () => {
  await assert.rejects(() => parseImportFile(new File(['x'], 'sample.txt'), 'usage_history'), /지원하지 않는 파일/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/import/parse.test.ts`
Expected: FAIL because parser is not defined.

- [ ] **Step 3: Write minimal implementation**

Use PapaParse for CSV and `xlsx.read`/`sheet_to_json` for XLSX on the server. Preserve all cell values as strings, reject empty headers, unsupported extensions, oversized files, and row counts over the explicit configured limit. Do not coerce nulls or dates.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/import/parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/import/parse.ts lib/import/parse.test.ts
git commit -m "STEP 4 CSV XLSX 서버 파서 추가"
```

### Task 3: 단일 Validation 모듈

**Files:**
- Create: `lib/import/validate.ts`
- Test: `lib/import/validate.test.ts`

**Interfaces:**
- `validateRows(input: ValidationInput): ValidationResult`
- `ValidationInput = { type: ImportType; rows: MappedImportRow[]; existingKeys?: Set<string>; itemIds?: Set<string>; supplierIds?: Set<string> }`
- `ValidationResult = { rows: ValidatedRow[]; errors: ValidationError[]; counts: { success: number; warning: number; error: number } }`

- [ ] **Step 1: Write failing tests**

```ts
test('알 수 없는 품목과 잘못된 날짜를 ERROR로 남긴다', () => {
  const result = validateRows({ type: 'usage_history', rows: [{ rowNumber: 2, values: { usage_id: 'U1', item_id: 'ITEM999', use_date: '2026-99-01', qty: '4' } }], itemIds: new Set(['ITEM001']) });
  assert.deepEqual(result.errors.map((e) => e.errorCode).sort(), ['INVALID_DATE', 'UNKNOWN_ITEM']);
});

test('null 수량을 0으로 바꾸지 않는다', () => {
  const result = validateRows({ type: 'usage_history', rows: [{ rowNumber: 2, values: { usage_id: 'U1', item_id: 'ITEM001', use_date: '2026-08-01', qty: '' } }], itemIds: new Set(['ITEM001']) });
  assert.equal(result.rows[0].values.qty, '');
  assert.equal(result.errors[0].errorCode, 'REQUIRED_VALUE_MISSING');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/import/validate.test.ts`
Expected: FAIL because `validateRows` is not defined.

- [ ] **Step 3: Write minimal implementation**

Implement required-column/value, strict number/date, file/existing duplicate, master existence, negative, and date-order rules. Return original values unchanged and attach error code/message/severity/originalValue. Use SUCCESS/WARNING/ERROR status only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/import/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/import/validate.ts lib/import/validate.test.ts
git commit -m "STEP 4 단일 데이터 검증 모듈 추가"
```

### Task 4: DB staging, batch, validation, import, rollback

**Files:**
- Create: `supabase/migrations/20260828000400_step4_import_pipeline.sql`
- Create: `supabase/tests/step4_import_pipeline.sql`

**Interfaces:**
- Tables: `core.upload_batch`, `core.import_staging`, `core.column_mapping`, `core.validation_error`, `core.forecast_run`
- Functions: `core.approve_import_batch(uuid)`, `core.import_batch(uuid)`, `core.rollback_batch(uuid)`

- [ ] **Step 1: Write SQL assertions first**

```sql
select has_table_privilege('anon', 'core.upload_batch', 'insert') as anon_upload_insert;
select has_table_privilege('authenticated', 'core.upload_batch', 'insert') as user_upload_insert;
select proname from pg_proc where pronamespace = 'core'::regnamespace and proname in ('approve_import_batch', 'import_batch', 'rollback_batch');
```

Expected after migration: anon insert false, authenticated direct insert false, and only approved SECURITY DEFINER functions exist for mutation.

- [ ] **Step 2: Run SQL test against the configured Supabase project**

Run the file in Supabase SQL Editor after applying the migration. Before remote credentials are available, validate SQL syntax and object references by inspection; do not claim remote execution.

- [ ] **Step 3: Write minimal migration**

Create RLS-enabled tables with FK `uploaded_by`/`confirmed_by`, JSONB original/mapped values, batch status checks, indexes, and grants. Implement functions with `core.is_admin()`, batch state checks, whitelist-based target table handling, `batch_id` metadata, transaction behavior, stale marking for demand types, and rollback restricted to matching batch/source. Keep replace rollback unsupported explicitly.

- [ ] **Step 4: Re-run SQL assertions**

Confirm no anon write, no authenticated direct raw write, batch metadata columns, and function definitions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260828000400_step4_import_pipeline.sql supabase/tests/step4_import_pipeline.sql
git commit -m "STEP 4 staging import rollback DB 구조 추가"
```

### Task 5: Repository and secured API routes

**Files:**
- Create: `lib/import/repository.ts`
- Create: `lib/import/history.ts`
- Create: `app/api/import/parse/route.ts`
- Create: `app/api/import/validate/route.ts`
- Create: `app/api/import/approve/route.ts`
- Create: `app/api/import/download-errors/route.ts`
- Create: `app/api/import/rollback/route.ts`
- Test: `lib/import/repository.test.ts`

**Interfaces:**
- `createUploadBatch(input): Promise<UploadBatch>`
- `saveStagingRows(batchId, rows): Promise<void>`
- `validateBatch(batchId, mapping): Promise<ValidationResult>`
- `approveBatch(batchId): Promise<void>`
- `importBatch(batchId): Promise<void>`
- `rollbackBatch(batchId): Promise<void>`

- [ ] **Step 1: Write failing repository contract test**

Test that an import cannot be approved before validation and that route-level auth rejects a missing session/admin. Use a small injected Supabase adapter rather than browser mocks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/import/repository.test.ts`
Expected: FAIL because repository functions are not defined.

- [ ] **Step 3: Implement repository and routes**

Every route starts with `requireAdmin()`, validates JSON/batch IDs, uses SSR cookies, never imports raw directly, and maps errors to explicit HTTP statuses. Parse creates batch/staging only. Validate stores mapping/errors and updates counts. Approve rejects ERROR or unvalidated batches. Import calls the DB function only after approval. Error CSV contains original columns plus row number/code/message/severity. Rollback returns the DB limitation for upsert/replace.

- [ ] **Step 4: Run tests**

Run: `npm test -- lib/import/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/import/repository.ts lib/import/history.ts app/api/import
 git commit -m "STEP 4 보안 import API와 repository 추가"
```

### Task 6: Admin Data Management UI and menu

**Files:**
- Create: `app/(admin)/admin/data-management/page.tsx`
- Create: `app/(admin)/admin/data-management/import-form.tsx`
- Modify: `lib/menu.ts`
- Modify: `components/shell/sidebar.tsx` only if grouping requires it
- Modify: `styles/components.css` only for missing existing-system classes
- Test: `lib/menu.test.ts` extension

**Interfaces:**
- UI states: `select → type/mode → preview → mapping → validation → result → approval → history`
- Import button disabled unless `validated && errorCount === 0 && approved`

- [ ] **Step 1: Write failing menu/UI contract test**

Assert `/admin/data-management` is present in `ADMIN_MENU` and import modes are rendered from the schema contract, not hardcoded inside the page.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/menu.test.ts`
Expected: FAIL because the menu entry is absent.

- [ ] **Step 3: Implement UI**

Use AppShell, Panel, Button, Badge, DataTable, EmptyValue. Show original preview and editable mapping, validation counts, replace warning/confirmation, error CSV link, import history table, and rollback action. Do not parse or validate in React.

- [ ] **Step 4: Run test and build**

Run: `npm test -- lib/menu.test.ts` and `npm run build`
Expected: PASS and successful build.

- [ ] **Step 5: Commit**

```bash
git add app/(admin)/admin/data-management lib/menu.ts lib/menu.test.ts styles/components.css components/shell/sidebar.tsx
git commit -m "STEP 4 관리자 데이터 관리 화면 추가"
```

### Task 7: Forecast stale and end-to-end safeguards

**Files:**
- Modify: `supabase/tests/step4_import_pipeline.sql`
- Create: `lib/import/integration.test.ts`
- Modify: `error.md` only if a new implementation error occurs

**Interfaces:**
- Demand import types: `usage_history`, `sales_order`, `business_event`
- Stale fields: `stale`, `stale_at`, `stale_reason = 'SOURCE_DATA_IMPORTED'`

- [ ] **Step 1: Write failing integration assertions**

Assert that a valid demand batch marks existing forecast runs stale, preserves result rows, and that rollback only deletes rows with the exact batch ID.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/import/integration.test.ts`
Expected: FAIL until repository/DB integration is connected.

- [ ] **Step 3: Implement only missing stale/rollback wiring**

Do not delete Forecast results. Do not alter STEP 3 views or calculation SQL. Keep replace marked non-rollbackable.

- [ ] **Step 4: Run complete verification**

Run: `npm test`, `npm run build`, and inspect `git diff --check`. Verify with SQL Editor that anon writes are denied and migration objects exist.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/step4_import_pipeline.sql lib/import/integration.test.ts error.md
git commit -m "STEP 4 적재 stale rollback 검증 추가"
```

## Final verification checklist

- [ ] CSV and XLSX parse on the server.
- [ ] Preview and mapping are visible and editable.
- [ ] Import is disabled before validation/approval.
- [ ] Invalid item/date/missing required/duplicate are explicit errors.
- [ ] Error CSV contains original values and error metadata.
- [ ] Only approved valid rows reach raw with complete batch metadata.
- [ ] append/upsert/replace behavior and limitations are visible.
- [ ] Exact batch rollback cannot delete another batch.
- [ ] Import History shows counts, status, user, and timestamps.
- [ ] Demand imports mark Forecast runs stale without deleting results.
- [ ] `npm test` passes.
- [ ] `npm run build` succeeds.
- [ ] Supabase migration is applied manually or through an authenticated deployment pipeline.
