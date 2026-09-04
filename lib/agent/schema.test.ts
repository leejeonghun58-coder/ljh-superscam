import test from 'node:test';
import assert from 'node:assert/strict';
import { agentAnswerJsonSchema, cannotAnswer, parseAgentAnswer, type AgentAnswer } from './schema.ts';

test('잘못된 JSON은 계산 불가 AgentAnswer로 변환된다', () => {
  const result = parseAgentAnswer('{bad json');
  assert.equal(result.cannot_answer, true);
  assert.equal(result.cannot_answer_reason, 'INVALID_JSON');
});

test('필드가 누락된 응답은 임의의 답변으로 통과시키지 않는다', () => {
  const result = parseAgentAnswer(JSON.stringify({ answer: '답변' }));
  assert.equal(result.cannot_answer, true);
  assert.equal(result.cannot_answer_reason, 'MISSING_REQUIRED_FIELD');
});

test('계산 불가 응답은 공통 계약의 모든 필드를 가진다', () => {
  const result = cannotAnswer('NO_DATA');
  assert.deepEqual(result, { answer: '', verdict: 'INSUFFICIENT_DATA', evidence: [], data_as_of: null, risk: 'UNKNOWN', recommended_action: null, cannot_answer: true, cannot_answer_reason: 'NO_DATA' });
});

test('Structured Outputs schema는 모든 객체를 닫고 모든 속성을 required로 둔다', () => {
  assert.equal(agentAnswerJsonSchema.additionalProperties, false);
  assert.deepEqual(agentAnswerJsonSchema.required, ['answer','verdict','evidence','data_as_of','risk','recommended_action','cannot_answer','cannot_answer_reason']);
  assert.equal(agentAnswerJsonSchema.properties.evidence.items.additionalProperties, false);
  assert.deepEqual(agentAnswerJsonSchema.properties.evidence.items.required, ['source','metric','value','period','interpretation']);
});

const _typeCheck: AgentAnswer | null = null;
void _typeCheck;
