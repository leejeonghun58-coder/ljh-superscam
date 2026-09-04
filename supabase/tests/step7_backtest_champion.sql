-- STEP 7 정적 계약 테스트: Supabase SQL Editor에서 실행합니다.
do $$ begin
  if to_regclass('core.backtest_run') is null then raise exception 'core.backtest_run missing'; end if;
  if to_regclass('core.model_performance') is null then raise exception 'core.model_performance missing'; end if;
  if to_regclass('core.champion_model') is null then raise exception 'core.champion_model missing'; end if;
  if to_regprocedure('core.run_backtest(uuid)') is null then raise exception 'core.run_backtest missing'; end if;
  if to_regprocedure('core.set_manual_champion(uuid,text,text,text)') is null then raise exception 'manual champion function missing'; end if;
end $$;

select table_schema, table_name
from information_schema.views
where table_schema = 'analytics'
  and table_name in ('v_backtest_run','v_model_performance','v_champion_model','v_backtest_detail');

select policyname from pg_policies
where schemaname = 'core' and tablename in ('backtest_run','model_performance','champion_model');
