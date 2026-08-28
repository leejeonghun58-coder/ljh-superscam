import AppShell from '@/components/shell/app-shell';
import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import DataTable, { type DataColumn } from '@/components/ui/data-table';
import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import { getLeadtimeGap } from '@/lib/scm';
import type { LeadtimeGap } from '@/lib/scm-model';
export const dynamic = 'force-dynamic';
const columns: DataColumn<LeadtimeGap>[] = [
 { key: 'supplier', label: '공급처' }, { key: 'country', label: '국가' },
 { key: 'masterLeadTime', label: '마스터', align: 'right', render: (r) => r.masterLeadTime === null ? <EmptyValue reason="NO_LEADTIME" /> : `${r.masterLeadTime}일` },
 { key: 'sampleCount', label: '표본수', align: 'right', render: (r) => r.sampleCount.toLocaleString() },
 { key: 'actualAverage', label: '실적평균', align: 'right', render: (r) => r.actualAverage === null ? <EmptyValue reason="NO_USAGE" /> : `${r.actualAverage.toFixed(1)}일` },
 { key: 'p80', label: 'P80', align: 'right', render: (r) => r.p80 === null ? <EmptyValue reason="NO_LEADTIME" /> : `${r.p80}일` },
 { key: 'gap', label: '격차', align: 'right', render: (r) => r.gap === null ? <EmptyValue reason="NO_LEADTIME" /> : `${r.gap > 0 ? '+' : ''}${r.gap}일` },
];
export default async function LeadtimePage() {
 const { rows, error } = await getLeadtimeGap();
 const body = error ? <Panel><p className="text-danger">조회에 실패했습니다: {error}</p></Panel> : <><div className="kpi-grid"><KpiCard label="공급처" value={rows.length} foot="사용 중인 생산법인" /><KpiCard label="실제가 더 김" value={rows.filter((r) => r.gap !== null && r.gap > 0).length} foot="격차가 양수인 공급처" tone="warning" /><KpiCard label="표본 부족" value={rows.filter((r) => r.sampleCount < 10).length} foot="표본 10건 미만" tone="warning" /></div><Panel title="공급처별 리드타임" meta="격차 = P80 − 마스터"><DataTable columns={columns} rows={rows} rowKey={(r, i) => `${r.supplier}-${i}`} empty="표시할 데이터가 없습니다. analytics.v_leadtime_gap을 확인하세요." /></Panel></>;
 return <section className="analysis-page"><PageHeader title="리드타임 격차" description="마스터 표준 리드타임과 실제 실적 P80을 비교해 계획이 현실보다 짧게 잡힌 공급처를 찾습니다." />{body}</section>;
}