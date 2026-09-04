import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentAnswer } from './schema.ts';
import { extractNumericClaims, mergeToolNumbers, validateAnswerNumbers } from './guardrail.ts';

const base: AgentAnswer = { answer: '', verdict: 'SUPPORTED', evidence: [], data_as_of: null, risk: 'LOW', recommended_action: null, cannot_answer: false, cannot_answer_reason: null };
const allowed = mergeToolNumbers('getShipmentTrend', { recent_qty: 779, avg_3m: 772.3, trend: -1.5, rate: 0.82, missing: null });
const answer = (changes: Partial<AgentAnswer>): AgentAnswer => ({ ...base, ...changes });

for (const [name, value] of [['정수', '최근 출고량은 779입니다.'], ['소수', '평균은 772.3입니다.'], ['음수', '추세는 -1.5입니다.'], ['백분율', '서비스율은 82%입니다.'], ['근거 여러 필드', '최근 출고량 779, 평균 772.3입니다.']]) {
  test(`정상 숫자 - ${name}`, () => { const text = name === '근거 여러 필드' ? answer({ answer: '최근 출고량 779', evidence: [{ source: 'getShipmentTrend', metric: '평균', value: '772.3', period: null, interpretation: null }] }) : answer({ answer: value }); const result = validateAnswerNumbers(text, allowed); assert.equal(result.ok, true); assert.deepEqual(result.unmatched, []); });
}
for (const [name, value] of [['조작 정수', '최근 출고량은 780입니다.'], ['조작 소수', '3개월 평균은 770.0입니다.'], ['조작 음수', '추세는 -2.5입니다.'], ['조작 백분율', '서비스율은 83%입니다.'], ['조작 근거', '최근 출고량 779, 평균 999입니다.']]) {
  test(`조작 숫자 - ${name}`, () => { const text = name === '조작 근거' ? answer({ answer: '최근 출고량 779', evidence: [{ source: 'getShipmentTrend', metric: '평균', value: '999', period: null, interpretation: null }] }) : answer({ answer: value }); const result = validateAnswerNumbers(text, allowed); assert.equal(result.ok, false); assert.ok(result.unmatched.length > 0); });
}

test('품목코드·기종코드·P80·연월·날짜·목록 번호는 숫자 주장으로 추출하지 않는다', () => { const claims = extractNumericClaims(answer({ answer: '602K02693 MDL121 P80 2026-07 2026-07-15 1. 항목' })); assert.deepEqual(claims, []); });
test('천단위 쉼표와 표기 반올림을 허용한다', () => { const result = validateAnswerNumbers(answer({ answer: '총량은 1,000.0입니다.' }), mergeToolNumbers('tool', { total: 1000.04 })); assert.equal(result.ok, true); });
test('0~1 비율의 백분율 표기만 원값과 연결한다', () => { const result = validateAnswerNumbers(answer({ answer: '달성률은 82%입니다.' }), mergeToolNumbers('tool', { rate: 0.82 })); assert.equal(result.ok, true); const rejected = validateAnswerNumbers(answer({ answer: '수량은 82%입니다.' }), mergeToolNumbers('tool', { qty: 82 })); assert.equal(rejected.ok, false); });
test('null Tool 숫자는 허용 숫자에서 제외한다', () => { const result = validateAnswerNumbers(answer({ answer: '값은 0입니다.' }), mergeToolNumbers('tool', { value: null })); assert.equal(result.ok, false); assert.equal(result.unmatched[0]?.raw, '0'); });

