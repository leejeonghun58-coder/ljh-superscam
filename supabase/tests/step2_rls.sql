-- STEP 2 RLS 점검용 SQL. Supabase SQL Editor에서 관리자/비관리자 세션으로 실행합니다.
-- 실제 결과는 auth.uid()와 core.app_user의 role/active에 따라 달라집니다.
select has_schema_privilege('anon', 'core', 'usage') as anon_core_usage,
       has_schema_privilege('anon', 'analytics', 'usage') as anon_analytics_usage,
       has_table_privilege('anon', 'core.app_user', 'insert') as anon_app_user_insert,
       has_table_privilege('anon', 'core.audit_log', 'insert') as anon_audit_insert;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'core'
  and tablename in ('app_user', 'audit_log', 'leadtime_plan', 'usage_profile')
order by tablename, policyname;

-- authenticated USER는 다음 UPDATE에서 0행/permission denied여야 합니다.
-- authenticated ADMIN은 다른 사용자의 role/active 변경이 가능하고 audit_log에 1행이 추가됩니다.
-- 어떤 role도 자기 자신의 role/active 변경은 trigger에서 거부됩니다.