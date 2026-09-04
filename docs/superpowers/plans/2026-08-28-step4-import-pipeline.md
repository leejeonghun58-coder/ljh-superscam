# STEP 4 Import Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 STEP 4 초안을 실제 raw/core 구조에 맞게 보완하여 서버 parsing, staging, validation, 승인 import, 이력, 오류 다운로드, rollback을 완성한다.

**Architecture:** 브라우저는 파일과 확인 상태만 관리하고 서버 API가 parsing·staging·validation을 수행한다. DB security-definer RPC가 승인 상태와 관리자 권한을 다시 확인한 뒤 SUCCESS 행만 RAW에 적재한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, PapaParse, xlsx, Supabase PostgreSQL, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-28-step4-import-pipeline-design.md`

## Global Constraints

- RAW 원본 데이터를 직접 수정하지 않고 승인된 Import RPC만 RAW를 변경한다.
- 화면 문구·주석은 한국어로 작성한다.
- 새 CSS 프레임워크를 추가하지 않고 기존 순수 CSS를 사용한다.
- 계산·검증 로직은 UI가 아닌 `lib/import`에 둔다.
- `npm test`와 `npm run build`를 실행한다.

---

### Task 1: 순수 import 모델과 검증 보완

**Files:**
- Modify: `lib/import/types.ts`
- Modify: `lib/import/schema.ts`
- Modify: `lib/import/validate.ts`
- Test: `lib/import/validate.test.ts`
- Test: `lib/import/schema.test.ts`

**Interfaces:**
- `validateRows(input)`은 `ValidationResult`를 반환한다.
- `suggestColumnMapping(type, headers)`는 source header별 target과 confidence를 반환한다.

- [ ] **Step 1: Write the failing test**

```ts
test('goods receipt가 발주일보다 빠른 입고일을 오류 처리한다', () => {
  const result = validateRows({
    type: 'goods_receipt',
    rows: [{ rowNumber: 2, values: { receipt_id: 'GR1', po_id: 'PO1', item_id: 'ITEM001', qty: '2', receipt_date: '2026-01-01', order_date: '2026-01-02' } }],
  });
  assert.equal(result.rows[0].status, 'ERROR');
  assert.equal(result.errors[0].errorCode, 'DATE_RELATION_INVALID');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/import/validate.test.ts`
Expected: FAIL because goods receipt date relation is not implemented.

- [ ] **Step 3: Write minimal implementation**

Add the `goods_receipt` relation check and ensure existing-key warnings never turn a row into ERROR. Keep raw values unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/import/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/import/types.ts lib/import/schema.ts lib/import/validate.ts lib/import/validate.test.ts lib/import/schema.test.ts
git commit -m "feat: import 검증 규칙 보완"
```

### Task 2: Parse/staging/repository 경계와 오류 CSV

**Files:**
- Modify: `lib/import/parse.ts`
- Modify: `lib/import/repository.ts`
- Modify: `app/api/import/parse/route.ts`
- Modify: `app/api/import/validate/route.ts`
- Modify: `app/api/import/download-errors/route.ts`
- Test: `lib/import/parse.test.ts`
- Test: `lib/import/repository.test.ts`

**Interfaces:**
- `parseImportFile(file, type)`은 서버에서 `ParsedImport`를 반환한다.
- `validateBatch(batchId, mapping)`은 staging 기반 `ValidationResult`를 저장하고 반환한다.
- 오류 다운로드는 원본 컬럼과 오류 메타데이터를 포함한다.

- [ ] **Step 1: Write the failing test**

```ts
test('지원하지 않는 확장자를 거부하고 원본 행을 보존한다', async () => {
  await assert.rejects(() => parseImportFile(new File(['a'], 'data.xls'), 'usage_history'), /지원하지 않는/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/import/parse.test.ts`
Expected: FAIL if `.xls` is accepted or error text differs.

- [ ] **Step 3: Write minimal implementation**

Validate mapping targets against the selected schema, load the latest saved mapping only as a suggestion, and preserve `original_row` for every staging row. Ensure errors from parsing/staging do not leave an untracked batch.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/import/parse.test.ts lib/import/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/import app/api/import
git commit -m "feat: import staging과 오류 다운로드 보완"
```

### Task 3: DB 승인/import/rollback 안전성

**Files:**
- Modify: `supabase/migrations/20260828000400_step4_import_pipeline.sql`
- Modify: `supabase/tests/step4_import_pipeline.sql`

**Interfaces:**
- `core.approve_import_batch(uuid, boolean)`은 검증 완료·오류 없음·replace 확인을 강제한다.
- `core.import_batch(uuid)`은 APPROVED batch의 SUCCESS staging 행만 RAW에 넣는다.
- `core.rollback_batch(uuid)`은 해당 batch의 FILE_UPLOAD 행만 제거한다.

- [ ] **Step 1: Write the failing SQL assertions**

```sql
select has_function_privilege('authenticated', 'core.rollback_batch(uuid)', 'execute') as can_rollback;
select has_table_privilege('authenticated', 'raw.usage_history', 'insert') as authenticated_raw_insert;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `supabase db test --file supabase/tests/step4_import_pipeline.sql`
Expected: current migration exposes the known replace-confirmation gap or fails where the local database is not migrated.

- [ ] **Step 3: Write minimal implementation**

Check `p_replace_confirmed` for replace, use explicit casts/null handling matching each raw table, use master tables/views that actually exist, and keep rollback predicates scoped by both `batch_id` and `source_type`.

- [ ] **Step 4: Run test to verify it passes**

Run: `supabase db test --file supabase/tests/step4_import_pipeline.sql`
Expected: RLS denies anon/raw direct writes and RPC privilege/policy checks pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260828000400_step4_import_pipeline.sql supabase/tests/step4_import_pipeline.sql
git commit -m "feat: import RPC 승인과 rollback 보안 강화"
```

### Task 4: 관리자 UI와 이력 표시

**Files:**
- Modify: `app/(admin)/admin/data-management/import-form.tsx`
- Modify: `app/(admin)/admin/data-management/history-table.tsx`
- Modify: `app/(admin)/admin/data-management/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing test**

Add a UI policy test asserting Import is disabled until validation exists and replace confirmation is checked.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/ui.test.ts`
Expected: FAIL before the UI policy is extracted/covered.

- [ ] **Step 3: Write minimal implementation**

Pass `replaceConfirmed` to the approve API, show user and imported time in history, show rollback unsupported status, and retain the ordered flow. Keep all validation out of the component.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/data-management" app/globals.css lib
git commit -m "feat: 관리자 import 화면과 이력 보완"
```

### Task 5: Full verification

**Files:**
- Verify: all changed files

- [ ] **Step 1: Run tests**

Run: `npm test`
Expected: exit code 0 and no failed tests.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: exit code 0 and successful Next.js production build.

- [ ] **Step 3: Inspect final diff and requirements**

Run: `git diff --check; git status --short`
Expected: no whitespace errors; only intended STEP 4/spec/plan files are changed.
