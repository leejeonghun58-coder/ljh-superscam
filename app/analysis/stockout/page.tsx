import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import DataTable, { type DataColumn } from '@/components/ui/data-table';
import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import { getStockoutKpi, getStockoutRisks } from '@/lib/scm';
import type { StockoutRisk } from '@/lib/scm-model';
export const dynamic = 'force-dynamic';
const numberCell = (value: number | null, reason = 'CALCULATION_UNAVAILABLE') => value === null ? <EmptyValue reason={reason} /> : Number.isInteger(value) ? String(value) : value.toFixed(1);
const columns: DataColumn<StockoutRisk>[] = [
 { key: 'itemId', label: '품목코드' }, { key: 'itemName', label: '품목명' }, { key: 'supplierId', label: '공급처' },
 { key: 'currentStock', label: '현재고', align: 'right', render: (r) => numberCell(r.currentStock) }, { key: 'inboundQty', label: '입고예정', align: 'right', render: (r) => numberCell(r.inboundQty) }, { key: 'availableQty', label: '가용수량', align: 'right', render: (r) => numberCell(r.availableQty) }, { key: 'dailyUsageAvg', label: '일평균 사용량', align: 'right', render: (r) => numberCell(r.dailyUsageAvg, 'NO_USAGE') }, { key: 'stockoutDays', label: '소진까지', align: 'right', render: (r) => numberCell(r.stockoutDays, r.reason ?? 'CALCULATION_UNAVAILABLE') }, { key: 'stockoutDate', label: '예상 소진일', render: (r) => r.stockoutDate ?? <EmptyValue reason={r.reason ?? 'CALCULATION_UNAVAILABLE'} /> },
 { key: 'riskStatus', label: '위험상태', render: (r) => <Badge status={r.riskStatus === 'SAFE' ? 'SAFE' : r.riskStatus === 'CRITICAL' ? 'CRITICAL' : 'CALCULATION_UNAVAILABLE'} /> }, { key: 'reason', label: '사유', render: (r) => r.reason ? <span>{r.reason}</span> : <EmptyValue /> },
];
export default async function StockoutPage() {
 const [{ data: kpi, error: kpiError }, { rows, error: rowsError }] = await Promise.all([getStockoutKpi(), getStockoutRisks()]);
 const error = kpiError ?? rowsError;
 return <section className="analysis-page"><PageHeader title="재고 소진 위험" description="가용재고와 일평균 사용량을 기준으로 리드타임 안에 재고가 소진될 품목을 찾습니다." />{error ? <Panel><p className="text-danger">조회에 실패했습니다: {error}</p></Panel> : !kpi || rows.length === 0 ? <Panel><p className="empty-state">표시할 데이터가 없습니다. analytics.v_stockout_risk와 analytics.v_stockout_kpi를 확인하세요.</p></Panel> : <><div className="kpi-grid"><KpiCard label="분석 품목" value={kpi.n_items} foot="활성 품목 기준" /><KpiCard label="소진 위험" value={kpi.n_critical} foot="리드타임 내 소진 예상" tone="critical" /><KpiCard label="안전" value={kpi.n_safe} foot="리드타임 이후 소진 예상" tone="safe" /><KpiCard label="30일 이내 소진" value={kpi.n_within_30d} foot="소진 예상일수 기준" tone="warning" /></div><Panel title="품목별 재고 소진 위험" meta="가용수량 ÷ 일평균 사용량"><DataTable columns={columns} rows={rows} rowKey={(r) => r.itemId} empty="표시할 데이터가 없습니다. analytics.v_stockout_risk를 확인하세요." /></Panel></>}</section>;
}