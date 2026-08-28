-- STEP 4 권한/객체 점검. migration 적용 후 Supabase SQL Editor에서 실행합니다.
select has_table_privilege('anon', 'core.upload_batch', 'insert') as anon_upload_insert;
select has_table_privilege('authenticated', 'raw.usage_history', 'insert') as authenticated_raw_insert;
select has_table_privilege('anon', 'raw.usage_history', 'insert') as anon_raw_insert;
select proname, prosecdef from pg_proc where pronamespace = 'core'::regnamespace and proname in ('approve_import_batch', 'import_batch', 'rollback_batch') order by proname;
select tablename, policyname, roles, cmd from pg_policies where schemaname = 'core' and tablename in ('upload_batch','import_staging','validation_error') order by tablename, policyname;
