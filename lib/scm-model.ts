export type LeadtimeGap = {
  supplier: string;
  country: string;
  masterLeadTime: number | null;
  sampleCount: number;
  actualAverage: number | null;
  p80: number | null;
  gap: number | null;
};

export type StockoutRiskStatus = 'SAFE' | 'CRITICAL' | 'UNKNOWN';
export type StockoutRiskReason = 'NO_USAGE' | 'NO_LEADTIME' | null;

export type StockoutRisk = {
  itemId: string;
  itemName: string;
  supplierId: string;
  currentStock: number | null;
  inboundQty: number | null;
  availableQty: number | null;
  dailyUsageAvg: number | null;
  cv: number | null;
  plannedLeadTime: number | null;
  stockoutDays: number | null;
  stockoutDate: string | null;
  riskStatus: StockoutRiskStatus;
  reason: StockoutRiskReason;
};

export type StockoutKpi = {
  n_items: number;
  n_critical: number;
  n_safe: number;
  n_unknown: number;
  n_within_30d: number;
  avg_stockout_days: number | null;
};

export function formatScmQueryError(message: string) {
  if (/invalid schema:\s*analytics/i.test(message)) {
    return `${message} — Supabase Project Settings > API > Data API > Exposed schemas에서 analytics를 체크하고 Save한 뒤 개발 서버를 재시작하세요. analytics 스키마가 없다면 dump.sql을 먼저 복원해야 합니다.`;
  }
  return message;
}

function value(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return null;
}

function numberValue(row: Record<string, unknown>, keys: string[]) {
  const raw = value(row, keys);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeLeadtimeGap(row: Record<string, unknown>): LeadtimeGap {
  return {
    supplier: String(value(row, ['supplier_name', 'supplier', '법인', '공급처', '공급업체명']) ?? '미정'),
    country: String(value(row, ['country', '국가']) ?? '미정'),
    masterLeadTime: numberValue(row, ['std_lead_time', 'master_lt', 'master_lead_time', 'planned_lead_time', '표준리드타임', '표준리드타임(일)', '마스터값']),
    sampleCount: numberValue(row, ['n_samples', 'sample_count', 'samples', '표본수']) ?? 0,
    actualAverage: numberValue(row, ['mean_days', 'actual_avg', 'actual_average', 'avg_lead_time', '실적평균']),
    p80: numberValue(row, ['p80_days', 'p80', 'P80']),
    gap: numberValue(row, ['gap_days', 'gap', 'leadtime_gap', '격차']),
  };
}

export function normalizeStockoutRisk(row: Record<string, unknown>): StockoutRisk {
  const status = String(value(row, ['risk_status', 'status', '위험상태']) ?? 'UNKNOWN').toUpperCase();
  const reason = value(row, ['reason', '사유']);

  return {
    itemId: String(value(row, ['item_id', 'item', '품목코드']) ?? '미정'),
    itemName: String(value(row, ['item_name', '품목명']) ?? '미정'),
    supplierId: String(value(row, ['supplier_id', 'supplier', '공급처']) ?? '미정'),
    currentStock: numberValue(row, ['current_stock', 'stock', '현재고']),
    inboundQty: numberValue(row, ['inbound_qty', 'inbound', '입고예정']),
    availableQty: numberValue(row, ['available_qty', 'available', '가용수량']),
    dailyUsageAvg: numberValue(row, ['daily_usage_avg', 'daily_avg', '일평균사용량']),
    cv: numberValue(row, ['cv', '변동계수']),
    plannedLeadTime: numberValue(row, ['planned_lead_time', 'effective_lead_time', 'lead_time', '계획리드타임']),
    stockoutDays: numberValue(row, ['stockout_days', '소진예상일수']),
    stockoutDate: value(row, ['stockout_date', '소진예상일']) === null
      ? null
      : String(value(row, ['stockout_date', '소진예상일'])),
    riskStatus: status === 'SAFE' || status === 'CRITICAL' ? status : 'UNKNOWN',
    reason: reason === 'NO_USAGE' || reason === 'NO_LEADTIME' ? reason : null,
  };
}
