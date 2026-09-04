import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import DataTable, { type DataColumn } from '@/components/ui/data-table';
import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import { getInventoryProjection, getStockoutKpi, getStockoutRisks } from '@/lib/scm';
import type { InventoryProjection, StockoutRisk } from '@/lib/scm-model';
export const dynamic = 'force-dynamic';
const numberCell = (value: number | null, reason = 'CALCULATION_UNAVAILABLE') => value === null ? <EmptyValue reason={reason} /> : Number.isInteger(value) ? String(value) : value.toFixed(1);
const riskBadge = (status: StockoutRisk['riskStatus']) => <Badge status={status === 'UNKNOWN' ? 'CALCULATION_UNAVAILABLE' : status} />;
const riskColumns: DataColumn<StockoutRisk>[] = [
 { key: 'itemId', label: '품목코드' }, { key: 'itemName', label: '품목명' }, { key: 'supplierId', label: '공급처' },
 { key: 'currentStock', label: '현재고', align: 'right', render: (r) => numberCell(r.currentStock, r.reason ?? 'NO_INVENTORY_DATA') },
 { key: 'effectiveLeadTime', label: 'Effective LT', align: 'right', render: (r) => numberCell(r.plannedLeadTime, r.reason ?? 'NO_LEADTIME') },
 { key: 'stockoutDate', label: '소진 예상 월', render: (r) => r.stockoutDate ?? <EmptyValue reason={r.reason ?? 'CALCULATION_UNAVAILABLE'} /> },
 { key: 'stockoutDays', label: '공급 가능 일수', align: 'right', render: (r) => numberCell(r.stockoutDays, r.reason ?? 'CALCULATION_UNAVAILABLE') },
 { key: 'riskStatus', label: '위험 상태', render: (r) => riskBadge(r.riskStatus) },
 { key: 'reason', label: '사유', render: (r) => r.reason ? <span>{r.reason}</span> : <EmptyValue /> },
];
const projectionColumns: DataColumn<InventoryProjection>[] = [
 { key: 'itemId', label: 'SKU' }, { key: 'period', label: '기간' },
 { key: 'beginningInventory', label: '기초 재고', align: 'right', render: r => numberCell(r.beginningInventory, r.reasonCode ?? 'NO_INVENTORY_DATA') },
 { key: 'scheduledReceipt', label: '입고 예정', align: 'right', render: r => numberCell(r.scheduledReceipt) },
 { key: 'confirmedSalesOrder', label: '확정수주', align: 'right', render: r => numberCell(r.confirmedSalesOrder) },
 { key: 'softAllocation', label: '가예약', align: 'right', render: r => <span title={r.softAllocationDataStatus}>{numberCell(r.softAllocation)}</span> },
 { key: 'forecastDemand', label: 'Forecast 수요', align: 'right', render: r => numberCell(r.forecastDemand, r.reasonCode ?? 'NO_FORECAST') },
 { key: 'endingProjectedInventory', label: '기말 예상재고', align: 'right', render: r => numberCell(r.endingProjectedInventory, r.reasonCode ?? 'CALCULATION_UNAVAILABLE') },
 { key: 'riskStatus', label: '위험 상태', render: r => riskBadge(r.riskStatus) },
];
export default async function StockoutPage() {
 const [{ data: kpi, error: kpiError }, { rows: risks, error: riskError }, { rows: projection, error: projectionError }] = await Promise.all([getStockoutKpi(), getStockoutRisks(), getInventoryProjection()]);
 const error = kpiError ?? riskError ?? projectionError;
 return <section className="analysis-page"><PageHeader title="재고 Projection·소진 위험" description="Champion Forecast와 입고예정·확정수주·가예약을 월별로 반영한 저장 결과를 조회합니다." />
 {error ? <Panel><p className="text-danger">조회에 실패했습니다: {error}</p></Panel> : !kpi || risks.length === 0 ? <Panel><p className="empty-state">표시할 데이터가 없습니다. STEP 9 migration과 analytics 노출 설정을 확인하세요.</p></Panel> : <>
  <div className="kpi-grid"><KpiCard label="분석 품목" value={kpi.n_items} foot="활성 품목 기준" /><KpiCard label="Critical" value={kpi.n_critical} foot="입고 예상보다 먼저 결품" tone="critical" /><KpiCard label="Warning" value={kpi.n_warning} foot="Lead Time 내 결품 예상" tone="warning" /><KpiCard label="계산 불가" value={kpi.n_unavailable} foot="재고·Forecast·Lead Time 부족" /></div>
  <Panel title="품목별 소진 위험" meta="월별 Projection 기반"><DataTable columns={riskColumns} rows={risks} rowKey={r => r.itemId} empty="표시할 데이터가 없습니다." /></Panel>
  <Panel title="월별 Inventory Projection" meta={`${projection.length.toLocaleString()}개 저장 행`}><DataTable columns={projectionColumns} rows={projection} rowKey={r => `${r.itemId}-${r.period}`} empty="Projection 결과가 없습니다." /></Panel>
 </>}</section>;
}
