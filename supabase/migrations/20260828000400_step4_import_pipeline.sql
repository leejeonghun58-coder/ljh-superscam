-- STEP 4: 파일 적재 staging, 검증 오류, 승인 import, rollback
create extension if not exists pgcrypto;

create table if not exists core.upload_batch (
  batch_id uuid primary key default gen_random_uuid(),
  file_name text not null,
  import_type text not null check (import_type in ('usage_history','inventory','item_master','supplier_master','purchase_order','goods_receipt','sales_order','business_event')),
  import_mode text not null check (import_mode in ('append','upsert','replace')),
  total_rows integer not null default 0 check (total_rows >= 0),
  success_rows integer not null default 0 check (success_rows >= 0),
  warning_rows integer not null default 0 check (warning_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  status text not null default 'STAGED' check (status in ('STAGED','VALIDATED','APPROVED','IMPORTED','ROLLED_BACK','FAILED')),
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  imported_at timestamptz,
  approved_at timestamptz,
  rollback_supported boolean not null default true,
  error_message text
);

create table if not exists core.import_staging (
  batch_id uuid not null references core.upload_batch(batch_id) on delete cascade,
  row_number integer not null check (row_number > 1),
  original_row jsonb not null,
  mapped_row jsonb not null default '{}'::jsonb,
  validation_status text not null default 'PENDING' check (validation_status in ('PENDING','SUCCESS','WARNING','ERROR')),
  created_at timestamptz not null default now(),
  primary key (batch_id, row_number)
);

create table if not exists core.column_mapping (
  mapping_id uuid primary key default gen_random_uuid(),
  import_type text not null,
  source_column text not null,
  target_column text not null,
  confidence text not null default 'AUTO' check (confidence in ('AUTO','MANUAL','UNMAPPED')),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  unique (import_type, source_column)
);

create table if not exists core.validation_error (
  validation_error_id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references core.upload_batch(batch_id) on delete cascade,
  row_number integer not null,
  field_name text not null,
  error_code text not null,
  error_message text not null,
  severity text not null check (severity in ('WARNING','ERROR')),
  original_value jsonb,
  created_at timestamptz not null default now()
);

create table if not exists core.forecast_run (
  run_id uuid primary key default gen_random_uuid(),
  data_snapshot_at timestamptz not null default now(),
  stale boolean not null default false,
  stale_at timestamptz,
  stale_reason text,
  updated_at timestamptz not null default now()
);

create index if not exists import_staging_batch_status_idx on core.import_staging(batch_id, validation_status);
create index if not exists validation_error_batch_idx on core.validation_error(batch_id, severity, row_number);
create index if not exists upload_batch_status_idx on core.upload_batch(status, uploaded_at desc);

alter table core.upload_batch enable row level security;
alter table core.import_staging enable row level security;
alter table core.column_mapping enable row level security;
alter table core.validation_error enable row level security;
alter table core.forecast_run enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['upload_batch','import_staging','column_mapping','validation_error','forecast_run'] loop
    execute format('drop policy if exists step4_admin_all on core.%I', table_name);
    execute format('create policy step4_admin_all on core.%I for all to authenticated using (core.is_admin()) with check (core.is_admin())', table_name);
  end loop;
end $$;

revoke all on core.upload_batch, core.import_staging, core.column_mapping, core.validation_error, core.forecast_run from anon;
revoke all on core.upload_batch, core.import_staging, core.column_mapping, core.validation_error, core.forecast_run from authenticated;
grant usage on schema core to authenticated;
grant select, insert, update, delete on core.upload_batch, core.import_staging, core.column_mapping, core.validation_error, core.forecast_run to authenticated;
create or replace view core.v_import_supplier_master as
select distinct upper(regexp_replace("공급업체코드", '[\s\-_]', '', 'g')) as supplier_id
from raw.supplier_master
where nullif(trim("공급업체코드"), '') is not null;
grant select on core.v_import_supplier_master to authenticated;

create or replace function core.approve_import_batch(p_batch_id uuid, p_replace_confirmed boolean default false)
returns void language plpgsql security definer set search_path = core, public as $$
declare v_batch core.upload_batch;
begin
  if not core.is_admin() then raise exception '관리자만 import를 승인할 수 있습니다'; end if;
  select * into v_batch from core.upload_batch where batch_id = p_batch_id for update;
  if not found then raise exception '존재하지 않는 batch입니다'; end if;
  if v_batch.status <> 'VALIDATED' then raise exception '검증 완료 batch만 승인할 수 있습니다'; end if;
  if v_batch.error_rows > 0 then raise exception 'ERROR 행이 있는 batch는 승인할 수 없습니다'; end if;
  if v_batch.import_mode = 'replace' and not p_replace_confirmed then raise exception 'replace는 사용자 확인이 필요합니다'; end if;
  update core.upload_batch set status = 'APPROVED', approved_at = now() where batch_id = p_batch_id;
end;
$$;

create or replace function core.import_batch(p_batch_id uuid)
returns void language plpgsql security definer set search_path = core, public as $$
declare
  b core.upload_batch;
  r record;
  v_source_id text;
  v_table text;
begin
  if not core.is_admin() then raise exception '관리자만 import할 수 있습니다'; end if;
  select * into b from core.upload_batch where batch_id = p_batch_id for update;
  if not found then raise exception '존재하지 않는 batch입니다'; end if;
  if b.status <> 'APPROVED' then raise exception '승인된 batch만 import할 수 있습니다'; end if;
  if b.error_rows > 0 then raise exception 'ERROR 행이 있는 batch는 import할 수 없습니다'; end if;
  if b.import_mode = 'replace' then
    v_table := case b.import_type
      when 'usage_history' then 'usage_history' when 'inventory' then 'inventory' when 'item_master' then 'item_master'
      when 'supplier_master' then 'supplier_master' when 'purchase_order' then 'purchase_order' when 'goods_receipt' then 'goods_receipt'
      when 'sales_order' then 'sales_order' when 'business_event' then 'business_event' end;
    execute format('delete from raw.%I', v_table);
    update core.upload_batch set rollback_supported = false where batch_id = p_batch_id;
  end if;
  for r in select mapped_row from core.import_staging where batch_id = p_batch_id and validation_status = 'SUCCESS' order by row_number loop
    if b.import_mode = 'upsert' then
      if b.import_type = 'usage_history' then delete from raw.usage_history where usage_id = r.mapped_row->>'usage_id';
      elsif b.import_type = 'inventory' then delete from raw.inventory where "품목코드" = r.mapped_row->>'item_id' and "창고" = r.mapped_row->>'warehouse' and "기준일자" = r.mapped_row->>'as_of_date';
      elsif b.import_type = 'item_master' then delete from raw.item_master where "품목코드" = r.mapped_row->>'item_id';
      elsif b.import_type = 'supplier_master' then delete from raw.supplier_master where "공급업체코드" = r.mapped_row->>'supplier_id';
      elsif b.import_type = 'purchase_order' then delete from raw.purchase_order where "발주번호" = r.mapped_row->>'po_id';
      elsif b.import_type = 'goods_receipt' then delete from raw.goods_receipt where "입고번호" = r.mapped_row->>'receipt_id';
      elsif b.import_type = 'sales_order' then delete from raw.sales_order where order_id = r.mapped_row->>'order_id';
      elsif b.import_type = 'business_event' then delete from raw.business_event where event_id = r.mapped_row->>'event_id';
      end if;
    end if;
    if b.import_type = 'usage_history' then
      v_source_id := r.mapped_row->>'usage_id';
      insert into raw.usage_history(usage_id,item_id,use_date,qty,warehouse,note,batch_id,source_type,loaded_at,source_record_id) values (r.mapped_row->>'usage_id',r.mapped_row->>'item_id',(r.mapped_row->>'use_date')::date,(r.mapped_row->>'qty')::numeric,r.mapped_row->>'warehouse',r.mapped_row->>'note',p_batch_id,'FILE_UPLOAD',now(),v_source_id);
    elsif b.import_type = 'inventory' then
      v_source_id := concat_ws('|',r.mapped_row->>'item_id',r.mapped_row->>'warehouse',r.mapped_row->>'as_of_date');
      insert into raw.inventory("품목코드","창고","현재고","기준일자","안전재고",batch_id,source_type,loaded_at,source_record_id) values (r.mapped_row->>'item_id',r.mapped_row->>'warehouse',r.mapped_row->>'current_stock',r.mapped_row->>'as_of_date',r.mapped_row->>'safety_stock',p_batch_id,'FILE_UPLOAD',now(),v_source_id);
    elsif b.import_type = 'item_master' then
      v_source_id := r.mapped_row->>'item_id';
      insert into raw.item_master("품목코드","품목명","품목구분","단위","표준단가","사용여부",supplier_id,batch_id,source_type,loaded_at,source_record_id) values (r.mapped_row->>'item_id',r.mapped_row->>'item_name',r.mapped_row->>'item_type',r.mapped_row->>'unit',r.mapped_row->>'unit_price',r.mapped_row->>'active',r.mapped_row->>'supplier_id',p_batch_id,'FILE_UPLOAD',now(),v_source_id);
    elsif b.import_type = 'supplier_master' then
      v_source_id := r.mapped_row->>'supplier_id';
      insert into raw.supplier_master("공급업체코드","공급업체명","국가","표준리드타임(일)","담당자","사용여부",batch_id,source_type,loaded_at,source_record_id) values (r.mapped_row->>'supplier_id',r.mapped_row->>'supplier_name',r.mapped_row->>'country',r.mapped_row->>'standard_lead_time',r.mapped_row->>'manager',r.mapped_row->>'active',p_batch_id,'FILE_UPLOAD',now(),v_source_id);
    elsif b.import_type = 'purchase_order' then
      v_source_id := r.mapped_row->>'po_id';
      insert into raw.purchase_order("발주번호","발주일","공급업체","품목코드","발주수량","단가","납기예정일","발주담당",batch_id,source_type,loaded_at,source_record_id) values (r.mapped_row->>'po_id',r.mapped_row->>'order_date',r.mapped_row->>'supplier_id',r.mapped_row->>'item_id',r.mapped_row->>'qty',r.mapped_row->>'unit_price',r.mapped_row->>'due_date',r.mapped_row->>'buyer',p_batch_id,'FILE_UPLOAD',now(),v_source_id);
    elsif b.import_type = 'goods_receipt' then
      v_source_id := r.mapped_row->>'receipt_id';
      insert into raw.goods_receipt("입고번호","발주번호","품목코드","입고수량","입고일","입고창고",batch_id,source_type,loaded_at,source_record_id) values (r.mapped_row->>'receipt_id',r.mapped_row->>'po_id',r.mapped_row->>'item_id',r.mapped_row->>'qty',r.mapped_row->>'receipt_date',r.mapped_row->>'warehouse',p_batch_id,'FILE_UPLOAD',now(),v_source_id);
    elsif b.import_type = 'sales_order' then
      v_source_id := r.mapped_row->>'order_id';
      insert into raw.sales_order(order_id,order_date,need_date,item_id,customer_id,supplier_id,quantity,unit_price,status,batch_id,source_type,loaded_at,source_record_id) values (r.mapped_row->>'order_id',(r.mapped_row->>'order_date')::date,nullif(r.mapped_row->>'need_date','')::date,r.mapped_row->>'item_id',r.mapped_row->>'customer_id',r.mapped_row->>'supplier_id',(r.mapped_row->>'quantity')::numeric,nullif(r.mapped_row->>'unit_price','')::numeric,r.mapped_row->>'status',p_batch_id,'FILE_UPLOAD',now(),v_source_id);
    elsif b.import_type = 'business_event' then
      v_source_id := r.mapped_row->>'event_id';
      insert into raw.business_event(event_id,event_type,event_date,item_id,supplier_id,quantity,amount,note,batch_id,source_type,loaded_at,source_record_id) values (r.mapped_row->>'event_id',r.mapped_row->>'event_type',(r.mapped_row->>'event_date')::date,r.mapped_row->>'item_id',r.mapped_row->>'supplier_id',nullif(r.mapped_row->>'quantity','')::numeric,nullif(r.mapped_row->>'amount','')::numeric,r.mapped_row->>'note',p_batch_id,'FILE_UPLOAD',now(),v_source_id);
    end if;
  end loop;
  if b.import_type in ('usage_history','sales_order','business_event') then
    update core.forecast_run set stale = true, stale_at = now(), stale_reason = 'SOURCE_DATA_IMPORTED', updated_at = now() where stale = false;
  end if;
  update core.upload_batch set status = 'IMPORTED', imported_at = now() where batch_id = p_batch_id;
exception when others then
  update core.upload_batch set status = 'FAILED', error_message = sqlerrm where batch_id = p_batch_id;
  raise;
end;
$$;

create or replace function core.rollback_batch(p_batch_id uuid)
returns void language plpgsql security definer set search_path = core, public as $$
declare b core.upload_batch;
begin
  if not core.is_admin() then raise exception '관리자만 rollback할 수 있습니다'; end if;
  select * into b from core.upload_batch where batch_id = p_batch_id for update;
  if not found then raise exception '존재하지 않는 batch입니다'; end if;
  if not b.rollback_supported then raise exception '이 batch는 rollback을 지원하지 않습니다'; end if;
  if b.status <> 'IMPORTED' then raise exception 'import 완료 batch만 rollback할 수 있습니다'; end if;
  delete from raw.usage_history where batch_id = p_batch_id and source_type = 'FILE_UPLOAD';
  delete from raw.inventory where batch_id = p_batch_id and source_type = 'FILE_UPLOAD';
  delete from raw.item_master where batch_id = p_batch_id and source_type = 'FILE_UPLOAD';
  delete from raw.supplier_master where batch_id = p_batch_id and source_type = 'FILE_UPLOAD';
  delete from raw.purchase_order where batch_id = p_batch_id and source_type = 'FILE_UPLOAD';
  delete from raw.goods_receipt where batch_id = p_batch_id and source_type = 'FILE_UPLOAD';
  delete from raw.sales_order where batch_id = p_batch_id and source_type = 'FILE_UPLOAD';
  delete from raw.business_event where batch_id = p_batch_id and source_type = 'FILE_UPLOAD';
  update core.upload_batch set status = 'ROLLED_BACK' where batch_id = p_batch_id;
end;
$$;

revoke all on function core.approve_import_batch(uuid, boolean), core.import_batch(uuid), core.rollback_batch(uuid) from public;
grant execute on function core.approve_import_batch(uuid, boolean), core.import_batch(uuid), core.rollback_batch(uuid) to authenticated;

