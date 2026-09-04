# STEP 4 데이터 적재 파이프라인 설계

## 목표

관리자만 CSV/XLSX 파일을 서버에서 파싱·검증하고, 사용자가 결과를 확인한 뒤 승인된 정상 행만 RAW 계층에 적재한다. 모든 적재는 batch 단위 이력과 rollback 경계를 가지며 수요 데이터 적재 시 Forecast를 stale 처리한다.

## 현재 상태

저장소에는 STEP 3의 RAW 격리와 STEP 4 초안 migration/UI/API가 이미 존재한다. 이번 작업은 새 타입을 만들지 않고 실제 RAW 테이블(`usage_history`, `inventory`, `item_master`, `supplier_master`, `purchase_order`, `goods_receipt`, `sales_order`, `business_event`)과 기존 batch 메타데이터를 기준으로 초안을 보완한다.

## 데이터 흐름

1. ADMIN이 파일·Import Type·Mode를 선택한다.
2. 서버가 파일 크기/확장자를 확인하고 CSV 또는 첫 XLSX 시트를 파싱한다.
3. `core.upload_batch`를 만들고 원본 행을 `core.import_staging`에 저장한다. 이 단계에서는 RAW를 쓰지 않는다.
4. 헤더 alias로 자동 매핑을 제안하고 사용자가 매핑을 확인·수정한다. 확정 매핑은 `core.column_mapping`에 저장한다.
5. 서버의 단일 순수 검증 모듈이 staging 원본과 매핑을 검사한다. 오류는 `core.validation_error`, 행 상태는 staging, 집계는 batch에 저장한다.
6. ERROR가 없고 상태가 `VALIDATED`인 batch만 승인한다. replace는 별도 확인 플래그가 없으면 승인하지 않는다.
7. DB security-definer RPC가 승인된 SUCCESS 행만 해당 RAW 테이블에 저장하고 STEP 3 메타데이터를 채운다.
8. 수요 관련 타입 적재 시 `core.forecast_run.stale=true`를 설정하되 Forecast 결과 행은 삭제하지 않는다.
9. append/upsert는 batch rollback이 가능하다. replace는 기존 전체 데이터를 삭제하므로 `rollback_supported=false`로 기록하고 rollback을 거부한다.

## 검증 규칙

- 타입별 필수 컬럼 및 필수값
- 숫자 형식과 허용하지 않는 음수
- 엄격한 `YYYY-MM-DD` 날짜 형식
- 파일 내부 natural key 중복 및 기존 RAW와의 충돌
- 등록된 품목/공급처 존재 여부
- 발주일보다 빠른 납기일, 주문일보다 빠른 필요일, 입고일보다 빠른 발주일 등 날짜 관계
- 추정·보정·조용한 제외 금지. 검증 불가 값은 원본 그대로 남기고 명시적 오류를 기록한다.

행 상태는 ERROR가 하나라도 있으면 ERROR, ERROR 없이 WARNING이 있으면 WARNING, 그 외 SUCCESS다. Import는 SUCCESS만 수행하며 WARNING은 원본 staging과 오류 이력에 보존한다.

## 보안

모든 API와 관리자 화면은 `requireAdmin()`을 사용한다. anon에는 RAW 권한을 부여하지 않고, 클라이언트에는 publishable key만 사용한다. RAW INSERT/DELETE는 authenticated 사용자가 직접 수행하지 않고 관리자 검사를 포함한 DB RPC에서만 수행한다.

## 오류 다운로드와 이력

ERROR/WARNING 오류마다 원본 컬럼과 `row_number`, `error_code`, `error_message`, `severity`를 CSV로 반환한다. History에는 파일명, 타입, 모드, 행 집계, 사용자, 업로드/적재 시각, 상태, rollback 가능 여부를 표시한다.

## 테스트 및 운영 제약

순수 parsing/mapping/validation/policy를 Node 테스트로 검증하고 migration에는 SQL 점검 쿼리를 둔다. 대량 파일은 서버 메모리와 Supabase 요청 크기의 영향을 받으므로 파일 20MB, 100,000행 제한을 유지한다. replace는 완전 rollback을 지원하지 않는다는 제약을 UI와 이력에 표시한다.
