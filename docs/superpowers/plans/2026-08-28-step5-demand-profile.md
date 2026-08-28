# STEP 5 SKU Demand Profile 구현 계획

## 목표

`core.v_train_demand`만 사용해 월별 수요 grid를 만들고 SKU별 ADI, CV², 추세, 최근 변화, peak, seasonality, 안정성과 수요 유형을 SQL analytics view로 제공한다. 화면은 저장된 결과만 조회한다.

## 작업 순서

1. `supabase/migrations/20260828000500_step5_demand_profile.sql`에 월별 grid, profile view, KPI view를 추가한다.
   - 기간 경계는 `core.forecast_setting`에서 읽는다.
   - 기간상 기록 부재는 0, 원본 null은 별도 reason으로 유지한다.
   - ADI/CV²/Trend/최근 변화율이 계산 불가능하면 null과 reason_code를 반환한다.
   - 수요 유형 기준은 지정된 SBC 기준만 사용한다.
   - 24개월 미만 seasonality는 null + `INSUFFICIENT_PERIODS`로 반환한다.
2. SQL 객체와 leakage 경계를 확인하는 migration test를 추가한다.
3. `lib/scm-model.ts`에 Demand Profile 타입/정규화 함수를 추가하고 실패 테스트부터 작성한다.
4. `lib/scm.ts`에 analytics view 조회 함수를 추가한다.
5. `/analysis/demand-profile`에 KPI 카드, 필터, 공통 Badge/EmptyValue/DataTable을 추가한다.
6. 테스트 및 빌드로 검증한다.

## 검증

- 매끈/간헐/변동/울퉁불퉁 네 유형
- 무수요 및 기간 부족 reason_code
- 24개월 미만 seasonality null
- test 기간 데이터는 view 원천에 포함되지 않음
- 화면에 통계 계산 로직 없음
- `npm test`, `npm run build`
