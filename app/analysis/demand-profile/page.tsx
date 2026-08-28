import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import EmptyValue from '@/components/ui/empty-value';
import { getDemandProfileKpi, getDemandProfiles } from '@/lib/scm';
import ProfileTable from './profile-table';
export const dynamic = 'force-dynamic';

export default async function DemandProfilePage() {
  const [profiles, kpi] = await Promise.all([getDemandProfiles(), getDemandProfileKpi()]);
  return <section className="analysis-page"><PageHeader eyebrow="DEMAND PROFILE" title="SKU 수요 프로파일" description="학습 구간의 수요 특성을 분류해 Forecast 모델 후보 선택의 기준을 제공합니다." />{profiles.error ? <Panel><p className="text-danger">조회에 실패했습니다: {profiles.error}</p></Panel> : <><div className="kpi-grid"><KpiCard label="분석 SKU" value={kpi.data?.totalItems ?? <EmptyValue reason="KPI_UNAVAILABLE" />} foot="학습 구간 기준" /><KpiCard label="SMOOTH" value={kpi.data?.nSmooth ?? <EmptyValue reason="KPI_UNAVAILABLE" />} foot="안정 수요" tone="safe" /><KpiCard label="Croston 후보" value={kpi.data?.nCrostonNeeded ?? <EmptyValue reason="KPI_UNAVAILABLE" />} foot="INTERMITTENT + LUMPY" tone="warning" /><KpiCard label="계산 불가" value={kpi.data?.nCalculationUnavailable ?? <EmptyValue reason="KPI_UNAVAILABLE" />} foot={kpi.error ? `KPI 조회 실패: ${kpi.error}` : '사유 코드 확인 필요'} tone="critical" /></div><Panel title="SKU별 수요 특성" meta="학습 데이터만 사용"><ProfileTable rows={profiles.rows} /></Panel></>}</section>;
}
