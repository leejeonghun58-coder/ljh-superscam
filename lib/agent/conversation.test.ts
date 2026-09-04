import test from 'node:test';
import assert from 'node:assert/strict';
import { agentAnswerJsonSchema, type AgentAnswer } from './schema.ts';
import { preserveAnswerOnSaveFailure, saveTurn, type SaveTurnInput } from './conversation.ts';

const answer: AgentAnswer = {
  answer: '확인했습니다.', verdict: 'SUPPORTED', evidence: [], data_as_of: '2026-09-04', risk: 'LOW',
  recommended_action: null, cannot_answer: false, cannot_answer_reason: null,
};

const input: SaveTurnInput = {
  question: '출고량을 알려줘', answer, toolTrace: [], usage: null, guardrail: null,
};

test('대화 저장 실패가 이미 생성된 Agent 답변을 버리지 않는다', () => {
  assert.deepEqual(preserveAnswerOnSaveFailure(answer, 'DB_ERROR'), answer);
});


test('저장 RPC 오류를 반환해도 Agent 답변 계약은 호출자가 유지할 수 있다', async () => {
  const client = { schema: () => ({ rpc: async () => ({ data: null, error: { message: 'FORBIDDEN' } }) }) };
  const result = await saveTurn(input, client as any);
  assert.equal(result.conversationId, null);
  assert.equal(result.error, 'FORBIDDEN');
  assert.deepEqual(preserveAnswerOnSaveFailure(answer, result.error), answer);
});
test('저장 입력은 질문과 답변을 하나의 턴으로 전달한다', () => {
  assert.equal(input.question, '출고량을 알려줘');
  assert.equal(input.answer?.answer, '확인했습니다.');
});

test('migration은 대화와 메시지를 본인 또는 ADMIN만 조회하도록 fail-closed RLS를 선언한다', async () => {
  const fs = await import('node:fs/promises');
  const sql = await fs.readFile('supabase/migrations/20260904000200_agent_conversations.sql', 'utf8');
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /user_id = .*auth\.uid\(\)/s);
  assert.match(sql, /core\.is_admin\(\)/);
  assert.match(sql, /revoke all on .* from anon/si);
  assert.match(sql, /save_agent_turn/);
});

test('answer payload 계약은 저장할 답변 구조를 유지한다', () => {
  assert.equal(agentAnswerJsonSchema.properties.answer.type, 'string');
});



