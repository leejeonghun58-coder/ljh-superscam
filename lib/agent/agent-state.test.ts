import assert from 'node:assert/strict';
import test from 'node:test';
import { cannotAnswer, type AgentAnswer } from './schema.ts';
import { agentReducer, initialAgentState, validateQuestion } from '../../app/(user)/agent/state.ts';

const answer: AgentAnswer = { answer: '재고를 확인하세요.', verdict: 'SUPPORTED', evidence: [], data_as_of: null, risk: 'LOW', recommended_action: '확인', cannot_answer: false, cannot_answer_reason: null };

test('빈 질문은 제출할 수 없다', () => { assert.equal(validateQuestion('   '), 'EMPTY_QUESTION'); const state = agentReducer(initialAgentState, { type: 'SUBMIT', question: '   ' }); assert.equal(state.status, 'error'); assert.equal(state.error, 'EMPTY_QUESTION'); });
test('정상 AgentAnswer는 성공 상태에 보존된다', () => { const state = agentReducer({ ...initialAgentState, status: 'submitting' }, { type: 'SUCCESS', answer }); assert.equal(state.status, 'success'); assert.deepEqual(state.answer, answer); assert.equal(state.error, null); });
test('계산 불가 AgentAnswer도 성공 응답으로 표시할 수 있다', () => { const unavailable = cannotAnswer('NO_DATA'); const state = agentReducer({ ...initialAgentState, status: 'submitting' }, { type: 'SUCCESS', answer: unavailable }); assert.equal(state.status, 'success'); assert.equal(state.answer?.cannot_answer, true); assert.equal(state.answer?.cannot_answer_reason, 'NO_DATA'); });
test('제출 시작과 실패 상태를 순서대로 관리한다', () => { const submitting = agentReducer(initialAgentState, { type: 'SUBMIT', question: '질문' }); assert.equal(submitting.status, 'submitting'); const failed = agentReducer(submitting, { type: 'FAILURE', error: 'LLM_ERROR' }); assert.equal(failed.status, 'error'); assert.equal(failed.error, 'LLM_ERROR'); });


