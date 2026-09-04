import type { AgentAnswer } from './schema.ts';

export type NumericClaim = { field: string; raw: string; value: number };
export type AllowedNumbers = Record<string, number>;
export type GuardrailResult = { ok: boolean; claims: NumericClaim[]; unmatched: NumericClaim[] };

const numberPattern = /-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?/g;
const excludedFields = new Set(['data_as_of', 'period', 'source']);

function isBoundary(text: string, start: number, end: number): boolean {
  const before = text[start - 1] ?? '';
  const after = text[end] ?? '';
  if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) return false;
  const around = text.slice(Math.max(0, start - 8), Math.min(text.length, end + 8));
  if (/\d{4}-\d{1,2}(?:-\d{1,2})?/.test(around)) return false;
  const linePrefix = text.slice(text.lastIndexOf('\n', start - 1) + 1, start);
  if (after === '.' && (/^\s*$/.test(linePrefix) || /\s/.test(text[end + 1] ?? ''))) return false;
  return true;
}
function parseNumber(raw: string): number { const percent = raw.endsWith('%'); const numeric = Number(raw.replace(/,/g, '').replace(/%$/, '')); return percent ? numeric / 100 : numeric; }
function answerTexts(answer: AgentAnswer): Array<[string, string]> { const texts: Array<[string, string]> = [['answer', answer.answer], ['recommended_action', answer.recommended_action ?? '']]; answer.evidence.forEach((evidence, index) => { for (const key of ['metric', 'value', 'interpretation'] as const) { const value = evidence[key]; if (typeof value === 'string') texts.push([`evidence[${index}].${key}`, value]); } }); return texts; }

export function extractNumericClaims(answer: AgentAnswer): NumericClaim[] {
  const claims: NumericClaim[] = [];
  for (const [field, text] of answerTexts(answer)) { numberPattern.lastIndex = 0; let match: RegExpExecArray | null; while ((match = numberPattern.exec(text))) { const raw = match[0]; if (!isBoundary(text, match.index, match.index + raw.length)) continue; const value = parseNumber(raw); if (Number.isFinite(value)) claims.push({ field, raw, value }); } }
  return claims;
}

export function mergeToolNumbers(toolName: string, numbers: Record<string, number | null>): AllowedNumbers { return Object.fromEntries(Object.entries(numbers).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)).map(([key, value]) => [`${toolName}.${key}`, value as number])); }
function matches(claim: NumericClaim, value: number): boolean { const decimalPart = claim.raw.replace(/,/g, '').replace(/%$/, '').split('.')[1]; const digits = (decimalPart?.length ?? 0) + (claim.raw.endsWith('%') ? 2 : 0); const tolerance = Math.max(1e-9, 0.5 * (10 ** -digits)); return Math.abs(claim.value - value) <= tolerance; }

export function validateAnswerNumbers(answer: AgentAnswer, allowed: AllowedNumbers): GuardrailResult {
  const claims = extractNumericClaims(answer);
  const unmatched = claims.filter((claim) => !Object.values(allowed).some((value) => matches(claim, value)));
  return { ok: unmatched.length === 0, claims, unmatched };
}

