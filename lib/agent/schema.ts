export type AgentVerdict = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'CONTRADICTED' | 'INSUFFICIENT_DATA';
export type AgentRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export type AgentEvidence = {
  source: string;
  metric: string | null;
  value: string | null;
  period: string | null;
  interpretation: string | null;
};

export type AgentAnswer = {
  answer: string;
  verdict: AgentVerdict;
  evidence: AgentEvidence[];
  data_as_of: string | null;
  risk: AgentRisk;
  recommended_action: string | null;
  cannot_answer: boolean;
  cannot_answer_reason: string | null;
};

type JsonSchema = Record<string, unknown>;

const evidenceSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    source: { type: 'string' },
    metric: { type: ['string', 'null'] },
    value: { type: ['string', 'null'] },
    period: { type: ['string', 'null'] },
    interpretation: { type: ['string', 'null'] },
  },
  required: ['source', 'metric', 'value', 'period', 'interpretation'],
};

export const agentAnswerJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string' },
    verdict: { type: 'string', enum: ['SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'INSUFFICIENT_DATA'] },
    evidence: { type: 'array', items: evidenceSchema },
    data_as_of: { type: ['string', 'null'] },
    risk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] },
    recommended_action: { type: ['string', 'null'] },
    cannot_answer: { type: 'boolean' },
    cannot_answer_reason: { type: ['string', 'null'] },
  },
  required: ['answer', 'verdict', 'evidence', 'data_as_of', 'risk', 'recommended_action', 'cannot_answer', 'cannot_answer_reason'],
};

export const agentAnswerResponseFormat = {
  type: 'json_schema',
  json_schema: { name: 'agent_answer', strict: true, schema: agentAnswerJsonSchema },
} as const;

const requiredFields: (keyof AgentAnswer)[] = ['answer', 'verdict', 'evidence', 'data_as_of', 'risk', 'recommended_action', 'cannot_answer', 'cannot_answer_reason'];
const verdicts = new Set<AgentVerdict>(['SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'INSUFFICIENT_DATA']);
const risks = new Set<AgentRisk>(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']);

export function cannotAnswer(reason: string): AgentAnswer {
  return { answer: '', verdict: 'INSUFFICIENT_DATA', evidence: [], data_as_of: null, risk: 'UNKNOWN', recommended_action: null, cannot_answer: true, cannot_answer_reason: reason };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isNullableString(value: unknown): value is string | null { return value === null || typeof value === 'string'; }
function isEvidence(value: unknown): value is AgentEvidence { if (!isRecord(value)) return false; return typeof value.source === 'string' && isNullableString(value.metric) && isNullableString(value.value) && isNullableString(value.period) && isNullableString(value.interpretation) && Object.keys(value).every((key) => ['source', 'metric', 'value', 'period', 'interpretation'].includes(key)); }
function isAgentAnswer(value: unknown): value is AgentAnswer { if (!isRecord(value)) return false; if (!requiredFields.every((field) => Object.prototype.hasOwnProperty.call(value, field))) return false; if (!Object.keys(value).every((key) => requiredFields.includes(key as keyof AgentAnswer))) return false; return typeof value.answer === 'string' && verdicts.has(value.verdict as AgentVerdict) && Array.isArray(value.evidence) && value.evidence.every(isEvidence) && isNullableString(value.data_as_of) && risks.has(value.risk as AgentRisk) && isNullableString(value.recommended_action) && typeof value.cannot_answer === 'boolean' && isNullableString(value.cannot_answer_reason) && (value.cannot_answer ? typeof value.cannot_answer_reason === 'string' && value.cannot_answer_reason.length > 0 : value.cannot_answer_reason === null); }

export function parseAgentAnswer(input: unknown): AgentAnswer {
  let parsed: unknown;
  if (typeof input === 'string') { try { parsed = JSON.parse(input); } catch { return cannotAnswer('INVALID_JSON'); } } else { parsed = input; }
  if (!isRecord(parsed) || !requiredFields.every((field) => Object.prototype.hasOwnProperty.call(parsed, field))) return cannotAnswer('MISSING_REQUIRED_FIELD');
  if (!isAgentAnswer(parsed)) return cannotAnswer('INVALID_FIELD');
  return parsed;
}

