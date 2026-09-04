-- Agent 운영형 대화 저장. 질문과 답변은 core.save_agent_turn 한 transaction에서 기록한다.

create table if not exists core.agent_conversation (
  conversation_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  title text not null default '새 대화',
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);

create table if not exists core.agent_message (
  message_id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references core.agent_conversation(conversation_id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  answer jsonb,
  tool_trace jsonb,
  usage jsonb,
  guardrail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_conversation_user_last_idx
  on core.agent_conversation(user_id, last_at desc);
create index if not exists agent_message_conversation_created_idx
  on core.agent_message(conversation_id, created_at);

alter table core.agent_conversation enable row level security;
alter table core.agent_message enable row level security;

revoke all on core.agent_conversation, core.agent_message from anon;

grant usage on schema core to authenticated;
grant select, insert on core.agent_conversation, core.agent_message to authenticated;

drop policy if exists agent_conversation_select_own_or_admin on core.agent_conversation;
create policy agent_conversation_select_own_or_admin
  on core.agent_conversation for select to authenticated
  using (user_id = (select auth.uid()) or core.is_admin());

drop policy if exists agent_conversation_insert_own on core.agent_conversation;
create policy agent_conversation_insert_own
  on core.agent_conversation for insert to authenticated
  with check (user_id = (select auth.uid()) and core.is_active_user());

drop policy if exists agent_message_select_own_or_admin on core.agent_message;
create policy agent_message_select_own_or_admin
  on core.agent_message for select to authenticated
  using (
    exists (
      select 1 from core.agent_conversation c
       where c.conversation_id = agent_message.conversation_id
         and (c.user_id = (select auth.uid()) or core.is_admin())
    )
  );

drop policy if exists agent_message_insert_own on core.agent_message;
create policy agent_message_insert_own
  on core.agent_message for insert to authenticated
  with check (
    exists (
      select 1 from core.agent_conversation c
       where c.conversation_id = agent_message.conversation_id
         and c.user_id = (select auth.uid())
         and core.is_active_user()
    )
  );

create or replace function core.save_agent_turn(
  p_conversation_id uuid default null,
  p_title text default null,
  p_question text default '',
  p_answer jsonb default null,
  p_tool_trace jsonb default '[]'::jsonb,
  p_usage jsonb default null,
  p_guardrail jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = core, public, pg_temp
as $$
declare
  v_conversation_id uuid := p_conversation_id;
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null or not core.is_active_user(v_user_id) then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  select coalesce(au.email, auth.jwt() ->> 'email', '')
    into v_email
    from core.app_user au
   where au.user_id = v_user_id
     and au.active = true;
  if v_email is null then
    raise exception '활성 사용자 프로필이 없습니다.' using errcode = '42501';
  end if;

  if v_conversation_id is null then
    insert into core.agent_conversation(user_id, user_email, title)
    values (v_user_id, v_email, coalesce(nullif(left(trim(p_title), 200), ''), left(trim(p_question), 200), '새 대화'))
    returning conversation_id into v_conversation_id;
  else
    perform 1 from core.agent_conversation
     where conversation_id = v_conversation_id
       and user_id = v_user_id
     for update;
    if not found then
      raise exception '대화에 접근할 수 없습니다.' using errcode = '42501';
    end if;
  end if;

  insert into core.agent_message(conversation_id, role, content)
  values (v_conversation_id, 'user', p_question);
  insert into core.agent_message(conversation_id, role, content, answer, tool_trace, usage, guardrail)
  values (v_conversation_id, 'assistant', coalesce(p_answer ->> 'answer', ''), p_answer, p_tool_trace, p_usage, p_guardrail);
  update core.agent_conversation set last_at = now() where conversation_id = v_conversation_id;
  return v_conversation_id;
end;
$$;

revoke all on function core.save_agent_turn(uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function core.save_agent_turn(uuid, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;


