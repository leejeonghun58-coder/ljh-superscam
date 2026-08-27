import AnalysisFrame from '@/components/analysis/analysis-frame';
import DataTable, { formatNumber, type Column } from '@/components/analysis/data-table';
import { getStockoutKpi, getStockoutRisks } from '@/lib/scm';
import type { StockoutRisk } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';

function RiskCell({ row }: { row: StockoutRisk }) {
  const label = row.riskStatus === 'CRITICAL'
    ? '위험'
    : row.riskStatus === 'SAFE'
      ? '안전'
      : '판정 불가';
  const tone = row.riskStatus === 'CRITICAL'
    ? 'red'
    : row.riskStatus === 'SAFE'
      ? 'green'
      : 'gray';

  return <span className={`tag ${tone}`}>{label}</span>;
}

function ReasonCell({ row }: { row: StockoutRisk }) {
  if (!row.reason) return <span className="muted">—</span>;
  return <span className="muted">{row.reason === 'NO_USAGE' ? '사용 이력 없음' : '리드타임 없음'}</span>;
}

const columns: Column<StockoutRisk>[] = [
  { key: 'itemId', label: '품목코드' },
  { key: 'itemName', label: '품목명' },
  { key: 'supplierId', label: '공급처' },
  { key: 'currentStock', label: '현재고', align: 'right', render: (r) => formatNumber(r.currentStock) },
  { key: 'inboundQty', label: '입고예정', align: 'right', render: (r) => formatNumber(r.inboundQty) },
  { key: 'availableQty', label: '가용수량', align: 'right', render: (r) => formatNumber(r.availableQty) },
  { key: 'dailyUsageAvg', label: '일평균 사용량', align: 'right', render: (r) => formatNumber(r.dailyUsageAvg) },
  { key: 'stockoutDays', label: '소진까지', align: 'right', render: (r) => formatNumber(r.stockoutDays, '일') },
  { key: 'stockoutDate', label: '예상 소진일', render: (r) => r.stockoutDate ?? '—' },
  { key: 'riskStatus', label: '위험상태', render: (r) => <RiskCell row={r} /> },
  { key: 'reason', label: '사유', render: (r) => <ReasonCell row={r} /> },
];

export default async function StockoutPage() {
  const [{ data: kpi, error: kpiError }, { rows, error: rowsError }] = await Promise.all([
    getStockoutKpi(),
    getStockoutRisks(),
  ]);

  const error = kpiError ?? rowsError;
  if (error) {
    return (
      <AnalysisFrame
        title="재고 소진 위험"
        description="가용재고와 일평균 사용량을 기준으로 리드타임 안에 재고가 소진될 품목을 찾습니다."
      >
        <div className="card">
          <p className="text-danger">조회에 실패했습니다.</p>
          <p className="muted">{error}</p>
        </div>
      </AnalysisFrame>
    );
  }

  if (!kpi || rows.length === 0) {
    return (
      <AnalysisFrame
        title="재고 소진 위험"
        description="가용재고와 일평균 사용량을 기준으로 리드타임 안에 재고가 소진될 품목을 찾습니다."
      >
        <div className="card">
          <p className="muted">
            표시할 데이터가 없습니다. Exposed schemas와 analytics.v_stockout_risk,
            analytics.v_stockout_kpi를 확인하세요.
          </p>
        </div>
      </AnalysisFrame>
    );
  }

  return (
    <AnalysisFrame
      title="재고 소진 위험"
      description="가용재고와 일평균 사용량을 기준으로 리드타임 안에 재고가 소진될 품목을 찾습니다."
    >
      <div className="grid grid-4">
        <div className="card metric">
          <div className="metric-label">분석 품목</div>
          <div className="metric-value">{kpi.n_items}</div>
          <div className="metric-foot">활성 품목 기준</div>
        </div>
        <div className="card metric">
          <div className="metric-label">소진 위험</div>
          <div className="metric-value">{kpi.n_critical}</div>
          <div className="metric-foot danger">리드타임 내 소진 예상</div>
        </div>
        <div className="card metric">
          <div className="metric-label">안전</div>
          <div className="metric-value">{kpi.n_safe}</div>
          <div className="metric-foot good">리드타임 이후 소진 예상</div>
        </div>
        <div className="card metric">
          <div className="metric-label">30일 이내 소진</div>
          <div className="metric-value">{kpi.n_within_30d}</div>
          <div className="metric-foot">소진예상일수 기준</div>
        </div>
      </div>

      <div className="section card">
        <div className="card-title">
          <h3>품목별 재고 소진 위험</h3>
          <span>가용수량 ÷ 일평균 사용량</span>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.itemId}
          empty="데이터가 없습니다. Exposed schemas와 analytics.v_stockout_risk를 확인하세요."
        />
      </div>
    </AnalysisFrame>
  );
}
