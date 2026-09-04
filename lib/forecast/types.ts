export const BASELINE_MODEL_IDS = ['MA_3M', 'MA_6M', 'WMA_3M', 'PY_SAME_MONTH', 'SEASONAL_NAIVE'] as const;
export type BaselineModelId = typeof BASELINE_MODEL_IDS[number];
export type DemandTypeCode = 'SMOOTH' | 'INTERMITTENT' | 'ERRATIC' | 'LUMPY';
export type ForecastRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export type ForecastModel = {
  modelId: string;
  modelName: string;
  family: string;
  engine: string;
  version: string;
  enabled: boolean;
  isDefault: boolean;
  applicableDemandType: DemandTypeCode[];
  parameters: Record<string, unknown>;
  description: string | null;
};

export type ForecastRun = {
  runId: string;
  status: ForecastRunStatus;
  granularity: string;
  trainStart: string | null;
  trainEnd: string | null;
  horizon: number;
  nModels: number;
  nItems: number;
  nRows: number;
  dataSnapshotAt: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  triggeredEmail: string | null;
  isStale: boolean;
  message: string | null;
};
