export type BacktestPerformance = {
  backtestRunId: string;
  forecastRunId: string;
  modelId: string;
  modelName: string;
  modelVersion: string;
  itemId: string;
  nPeriods: number;
  wape: number | null;
  mape: number | null;
  bias: number | null;
  rmse: number | null;
  mae: number | null;
  baselineImprovement: number | null;
  rank: number | null;
  calculationStatus: 'SUCCESS' | 'UNAVAILABLE';
  reasonCode: string | null;
};

export type BacktestChartPoint = {
  period: string;
  actual: number | null;
  forecasts: Record<string, number | null>;
  intervals: Record<string, { p80: number | null; p90: number | null }>;
};

export type ChampionModel = { backtestRunId: string; itemId: string; championModelId: string; modelVersion: string; championMetric: string; championMetricValue: number | null; selectionMethod: 'AUTO' | 'MANUAL'; selectionReason: string; };
export type BacktestDetail = { backtestRunId: string; forecastRunId: string; modelId: string; itemId: string; period: string; actual: number | null; p50: number | null; p80: number | null; p90: number | null; sigma: number | null; reasonCode: string | null; };

export function formatMetric(value: number | null, percent = false) {
  if (value === null || !Number.isFinite(value)) return null;
  return percent ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
}
