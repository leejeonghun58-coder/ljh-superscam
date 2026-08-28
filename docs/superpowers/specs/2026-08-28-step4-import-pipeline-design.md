# STEP 4 데이터 적재 파이프라인 설계

## 목표

CSV와 XLSX 파일을 서버에서 파싱·검증하고, 사용자가 검증 결과를 확인한 뒤에만 승인된 행을 `raw` 계층에 저장한다. 모든 작업은 batch 단위로 추적하며 오류 조회·오류 CSV 다운로드·rollback·Forecast stale 표시를 제공한다.

## 범위와 권한

- Data Management는 `/admin/data-management` 아래에 둔다.
- 초기 Import와 `replace`는 ADMIN 전용으로 구현한다.
- Route Handler, Server Action, DB 함수 모두 `requireAdmin()` 또는 `core.is_admin()`을 수행한다.
- 브라우저에는 publishable key만 존재하며 secret/service key는 사용하지 않는다.
- 기존 raw 데이터 계산 SQL과 STEP 3의 train/test 경계는 변경하지 않는다.

## 지원 Import Type

현재 실제 raw 테이블에 존재하는 타입만 허용한다.

| Import Type | 대상 테이블 | 기본 키/업서트 키 | 주요 필수 컬럼 |
|---|---|---|---|
| `usage_history` | `raw.usage_history` | `usage_id` | `usage_id`, `item_id`, `use_date`, `qty` |
| `inventory` | `raw.inventory` | `item_id + warehouse + as_of_date` | 품목코드, 창고, 현재고, 기준일자 |
| `item_master` | `raw.item_master` | 품목코드 | 품목코드, 품목명, 사용여부 |
| `supplier_master` | `raw.supplier_master` | 공급업체코드 | 공급업체코드, 공급업체명, 사용여부 |
| `purchase_order` | `raw.purchase_order` | 발주번호 | 발주번호, 발주일, 품목코드, 발주수량 |
| `goods_receipt` | `raw.goods_receipt` | 입고번호 | 입고번호, 발주번호, 품목코드, 입고수량, 입고일 |
| `sales_order` | `raw.sales_order` | `order_id` | `order_id`, `order_date`, `item_id`, `quantity` |
| `business_event` | `raw.business_event` | `event_id` | `event_id`, `event_type`, `event_date` |

`inventory`의 시스템 표준 컬럼은 기존 raw 컬럼을 보존하기 위해 내부 표준명 `item_code`, `warehouse`, `current_stock`, `as_of_date`, `safety_stock`으로 매핑한 후 저장 함수에서 기존 한국어 컬럼명으로 변환한다. 새로운 raw 컬럼은 추가하지 않는다.

## 전체 흐름

```text
파일 선택
  → Import Type/Mode 선택
  → 서버 Parse
  → staging 저장
  → Preview
  → 자동 Column Mapping 제안
  → 사용자 Mapping 확인/수정
  → 서버 Validation
  → Validation Result + 오류 CSV
  → 사용자 승인
  → DB import 함수
  → raw 저장 + batch 상태 완료
  → Import History
```

검증 완료 상태가 아니거나 ERROR가 1건 이상인 batch는 승인·Import할 수 없다. WARNING은 사용자가 경고를 확인한 뒤 승인할 수 있다. 원본 행은 staging에 JSONB로 보존하며, 오류 행도 삭제하지 않는다.

## 애플리케이션 모듈

- `lib/import/types.ts`: ImportType, ImportMode, BatchStatus, ValidationSeverity와 행/매핑 계약
- `lib/import/schema.ts`: 허용 타입, DB 대상, 필수 필드, 타입 규칙, upsert 키, 한국어/영문 alias
- `lib/import/parse.ts`: CSV/PapaParse와 XLSX/xlsx 서버 파서. 파일 크기·행 수 제한을 검사하고 원본 값을 문자열로 보존
- `lib/import/validate.ts`: 필수값, null, 숫자, 날짜, 중복, item/supplier master 존재, 음수, 날짜 선후 관계를 단일 함수로 검증
- `lib/import/repository.ts`: staging/batch/mapping/error 조회와 승인·import·rollback RPC 호출
- `lib/import/history.ts`: History/Validation Error 조회용 서버 함수
- `app/api/import/parse/route.ts`: 파일 업로드와 서버 parse/staging
- `app/api/import/validate/route.ts`: mapping 저장과 validation 실행
- `app/api/import/approve/route.ts`: 승인 상태 전환
- `app/api/import/download-errors/route.ts`: ERROR/WARNING 원본값 + 오류 메타 CSV
- `app/api/import/rollback/route.ts`: batch rollback
- `app/(admin)/admin/data-management/page.tsx`: 업로드·Preview·Mapping·Validation·History 화면

Validation 함수는 DB 접근을 주입받거나 master snapshot을 인자로 받아 STEP 19 API 적재에서도 재사용한다. 화면 컴포넌트는 검증 규칙을 포함하지 않는다.

## DB 객체

STEP 4 migration은 다음 객체를 `core`에 추가한다.

- `core.upload_batch`: batch_id, file_name, import_type, import_mode, total_rows, success_rows, warning_rows, error_rows, status, uploaded_by, uploaded_at, imported_at, rollback_supported, approved_at, error_message
- `core.import_staging`: batch_id, row_number, original_row JSONB, mapped_row JSONB, validation_status, created_at
- `core.column_mapping`: import_type, source_column, target_column, confidence, confirmed_by, confirmed_at
- `core.validation_error`: batch_id, row_number, field_name, error_code, error_message, severity, original_value JSONB, created_at
- `core.forecast_run`: run_id, data_snapshot_at, stale, stale_at, stale_reason, updated_at

`core.import_batch(batch_id)`는 ADMIN과 승인 상태를 확인한 뒤 append/upsert/replace를 트랜잭션으로 수행한다. 이 함수가 `batch_id`, `source_type = 'FILE_UPLOAD'`, `loaded_at`, `source_record_id`를 모든 raw 행에 기록한다.

`core.rollback_batch(batch_id)`는 `source_type = 'FILE_UPLOAD'` 및 `batch_id`가 일치하는 행만 삭제한다. append/upsert의 새 batch 행은 rollback 가능하다. upsert로 덮어쓴 이전 값은 별도 snapshot을 보존하지 않으므로 원상 복구가 불가능하며 UI에 제한을 표시한다. replace는 기존 전체 데이터를 삭제할 수 있으므로 2단계 확인을 요구하고 rollback을 지원하지 않는다.

## Validation 규칙

| 분류 | 조건 | 결과 |
|---|---|---|
| 필수 컬럼 | 표준 필수 컬럼 매핑 누락 | ERROR / `MISSING_REQUIRED_COLUMN` |
| 필수값 | 필수 필드가 null 또는 빈 문자열 | ERROR / `REQUIRED_VALUE_MISSING` |
| 숫자 | 수량·재고·단가가 숫자가 아님 | ERROR / `INVALID_NUMBER` |
| 날짜 | ISO 또는 허용 날짜 형식이 아님 | ERROR / `INVALID_DATE` |
| 중복 | 파일 내부 또는 기존 키와 중복 | ERROR 또는 WARNING / `DUPLICATE_KEY` |
| 품목 | item master에 없는 품목 | ERROR / `UNKNOWN_ITEM` |
| 공급처 | supplier master에 없는 공급처 | ERROR / `UNKNOWN_SUPPLIER` |
| 음수 | 반품 허용 대상이 아닌 수량·재고가 음수 | ERROR / `NEGATIVE_NOT_ALLOWED` |
| 날짜 논리 | 입고일이 발주일보다 빠름 | ERROR / `DATE_ORDER_INVALID` |
| 매핑 신뢰도 | 자동 추정만 되었고 사용자 확인 전 | WARNING / `MAPPING_UNCONFIRMED` |

잘못된 날짜·null 수량·unknown master는 보정하거나 조용히 제외하지 않는다. 계산·검증 불가도 reason code와 원본값을 남긴다.

## Import Mode

- `append`: 신규 행을 추가한다. 키 충돌은 validation ERROR로 처리한다.
- `upsert`: 지정된 natural key 기준으로 신규 행은 추가하고 기존 행은 갱신한다. 덮어쓰기 전 값은 audit metadata에 남기지만 원상복구 snapshot은 보장하지 않는다.
- `replace`: 대상 raw 테이블의 기존 데이터를 교체한다. 관리자 확인과 경고 문구가 필수이며 rollback 불가를 명시한다.

## Forecast stale

`usage_history`, `sales_order`, `business_event`가 정상 import되면 기존 `core.forecast_run`의 `stale`을 true로 바꾸고 `stale_reason = 'SOURCE_DATA_IMPORTED'`와 `stale_at`을 기록한다. Forecast 결과 행은 삭제하지 않는다. 현재 Forecast run이 없으면 future run을 위해 테이블만 준비하고 상태 변경 대상은 0건으로 처리한다.

## 보안과 오류 처리

- anon은 upload, staging, validation error, import, rollback RPC를 실행할 수 없다.
- authenticated USER도 관리자 Route Handler와 DB 함수에서 거부한다.
- raw 테이블 직접 쓰기 권한은 계속 차단한다.
- parse 실패, mapping 실패, validation 실패, import 실패를 batch status와 오류 메시지로 구분한다.
- 파일 원본값은 오류 CSV에 포함될 수 있으므로 관리자 화면에서만 제공한다.

## 검증 계획

- parser: CSV/XLSX 헤더와 행 보존
- mapping: 한국어/영문 alias 자동 추정과 사용자 확정
- validation: 필수값·날짜·숫자·중복·master·음수·날짜 순서
- DB SQL: anon 차단, USER 차단, ADMIN 승인 import, batch metadata, rollback 범위
- UI: validation 전 Import disabled, ERROR CSV, replace 제한, history 상태
- 실행: `npm test`, `npm run build`

## 운영 제약

- Supabase migration은 원격 프로젝트에 별도 적용해야 한다.
- 현재 프로젝트에는 Supabase CLI/service-role 환경변수가 없으므로, 실제 DB 적용과 대량 파일 timeout은 배포 환경에서 확인해야 한다.
- 초기 구현은 관리자 전용이며, 대량 비동기 job/스토리지 원본 보관은 후속 단계로 둔다.
- raw 테이블의 기존 한국어 컬럼 구조를 보존하므로 타입별 저장 매핑을 계속 관리해야 한다.
