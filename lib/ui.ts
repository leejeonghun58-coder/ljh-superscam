export type ScmStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE';

export const STATUS_LABELS: Record<ScmStatus, string> = {
  SAFE: '안전',
  WARNING: '주의',
  CRITICAL: '위험',
  CALCULATION_UNAVAILABLE: '계산 불가',
};

export function formatUnavailable(reason?: string | null) {
  return `—${reason ? ` + ${reason}` : ''}`;
}

export function formatUiValue(value: number | string | null | undefined, reason?: string | null) {
  if (value === null || value === undefined || value === '') return formatUnavailable(reason);
  return String(value);
}
