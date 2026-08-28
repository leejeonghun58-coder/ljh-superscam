-- STEP 2: 인증 사용자, 감사 로그, ADMIN/USER RLS
-- raw/analytics 계산 로직은 변경하지 않습니다.
create schema if not exists core;
create table if not exists core.app_user (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, department text,
  role text not null default 'USER' check (role in ('ADMIN', 'USER')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists core.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id) on delete set null,
  action text not null, target_type text not null, target_id text,
  before jsonb, after jsonb, at timestamptz not null default now()
);
create index if not exists app_user_role_active_idx on core.app_user(role, active);
create index if not exists audit_log_target_idx on core.audit_log(target_type, target_id);
create index if not exists audit_log_actor_idx on core.audit_log(actor);
create or replace function core.set_app_user_updated_at() returns trigger language plpgsql set search_path = core, public as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists app_user_set_updated_at on core.app_user;
create trigger app_user_set_updated_at before update on core.app_user for each row execute function core.set_app_user_updated_at();

create or replace function core.is_admin() returns boolean language sql stable security definer set search_path = core, public as $$ select exists (select 1 from core.app_user where user_id = auth.uid() and role = 'ADMIN' and active = true); $$;
revoke all on function core.is_admin() from public;
grant execute on function core.is_admin() to authenticated;
create or replace function core.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = core, public as $$ begin insert into core.app_user(user_id, email, name) values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name')) on conflict (user_id) do update set email = excluded.email; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function core.handle_new_auth_user();
create or replace function core.prevent_self_access_change() returns trigger language plpgsql set search_path = core, public as $$ begin if auth.uid() = old.user_id and (new.role is distinct from old.role or new.active is distinct from old.active) then raise exception '자기 자신의 role 또는 active 상태는 변경할 수 없습니다'; end if; return new; end; $$;
drop trigger if exists app_user_prevent_self_access_change on core.app_user;
create trigger app_user_prevent_self_access_change before update on core.app_user for each row execute function core.prevent_self_access_change();
create or replace function core.audit_app_user_access_change() returns trigger language plpgsql security definer set search_path = core, public as $$ begin if old.role is distinct from new.role or old.active is distinct from new.active then insert into core.audit_log(actor, action, target_type, target_id, before, after) values (auth.uid(), 'UPDATE_USER_ACCESS', 'app_user', new.user_id::text, jsonb_build_object('role', old.role, 'active', old.active), jsonb_build_object('role', new.role, 'active', new.active)); end if; return new; end; $$;
drop trigger if exists app_user_audit_access_change on core.app_user;
create trigger app_user_audit_access_change after update on core.app_user for each row execute function core.audit_app_user_access_change();
create or replace function core.audit_app_user_insert() returns trigger language plpgsql security definer set search_path = core, public as $$ begin insert into core.audit_log(actor, action, target_type, target_id, after) values (auth.uid(), 'CREATE_USER_PROFILE', 'app_user', new.user_id::text, jsonb_build_object('email', new.email, 'role', new.role, 'active', new.active)); return new; end; $$;
drop trigger if exists app_user_audit_insert on core.app_user;
create trigger app_user_audit_insert after insert on core.app_user for each row execute function core.audit_app_user_insert();
create or replace function core.app_user_update_guard() returns trigger language plpgsql security definer set search_path = core, public as $$ begin if not core.is_admin() then raise exception '관리자만 사용자를 변경할 수 있습니다'; end if; if auth.uid() = old.user_id and (new.role is distinct from old.role or new.active is distinct from old.active) then raise exception '자기 자신의 role 또는 active 상태는 변경할 수 없습니다'; end if; return new; end; $$;
drop trigger if exists app_user_update_guard on core.app_user;
create trigger app_user_update_guard before update on core.app_user for each row execute function core.app_user_update_guard();
alter table core.app_user enable row level security;
alter table core.audit_log enable row level security;
drop policy if exists "app_user_authenticated_read" on core.app_user;
create policy "app_user_authenticated_read" on core.app_user for select to authenticated using (auth.uid() is not null);
drop policy if exists "app_user_admin_update" on core.app_user;
create policy "app_user_admin_update" on core.app_user for update to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists "audit_log_admin_read" on core.audit_log;
create policy "audit_log_admin_read" on core.audit_log for select to authenticated using (core.is_admin());
revoke all on schema core from anon;
revoke all on all tables in schema core from anon;
revoke insert, update, delete on core.leadtime_plan from authenticated;
revoke insert, update, delete on core.usage_profile from authenticated;
grant usage on schema core to authenticated;
grant select on core.app_user, core.audit_log to authenticated;
grant update on core.app_user to authenticated;
grant usage on schema analytics to authenticated;
grant select on all tables in schema analytics to authenticated;
revoke all on schema analytics from anon;
revoke all on all tables in schema analytics from anon;
drop policy if exists "수업용 전체 허용" on core.leadtime_plan;
drop policy if exists "수업용 전체 허용" on core.usage_profile;
create or replace function core.record_login()
returns void
language sql
security definer
set search_path = core, public
as $$
  update core.app_user set last_login_at = now() where user_id = auth.uid();
$$;
revoke all on function core.record_login() from public;
grant execute on function core.record_login() to authenticated;
