import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import LeadTimePolicyForm from './policy-form';
export const dynamic = 'force-dynamic';
export default async function LeadTimePolicyPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('analytics').from('v_leadtime_policy').select('*').order('supplier_id').order('item_id');
  return <section className="analysis-page"><PageHeader eyebrow="ADMIN / SCM POLICIES" title="Lead Time 정책" description="관리자 확정값을 우선 적용하고, 없으면 정책 표본 기준의 실적 P80을 사용합니다." />
    {error ? <Panel><p className="text-danger">조회에 실패했습니다: {error.message}</p></Panel> : <><Panel title="정책 변경" meta="ADMIN 전용"><LeadTimePolicyForm /></Panel><Panel title="Item / Supplier별 Effective Lead Time" meta={`${data?.length ?? 0}건`}><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Supplier</th><th>실적</th><th>P50</th><th>P80</th><th>P90</th><th>관리자 확정</th><th>Effective</th><th>적용일</th><th>변경자</th><th>이력</th></tr></thead><tbody>{(data ?? []).map((r) => <tr key={`${r.item_id}-${r.supplier_id}`}><td>{r.item_id}<small>{r.item_name}</small></td><td>{r.supplier_name ?? r.supplier_id}</td><td>{r.mean_days ?? '—'}</td><td>{r.p50_days ?? '—'}</td><td>{r.p80_days ?? '—'}</td><td>{r.p90_days ?? '—'}</td><td>{r.admin_confirmed_lead_time ?? '—'}</td><td>{r.effective_lead_time ?? '—'} {r.effective_lead_time_source ? `(${r.effective_lead_time_source})` : ''}</td><td>{r.applied_at ?? '—'}</td><td>{r.last_changed_by ?? '—'}</td><td>{r.change_count ?? 0}</td></tr>)}</tbody></table></div></Panel></>}</section>;
}
