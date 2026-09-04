'use client';

import { useState, useTransition } from 'react';
import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import Panel from '@/components/ui/panel';
import type { AgentActionResult } from './actions';
import { agentReducer, initialAgentState, validateQuestion } from './state';
import { askAgent } from './actions';

const examples = ['최근 출고 추이를 알려줘', '수요가 불안정한 품목을 찾아줘', 'MDL121 BOM 구성을 확인해줘', 'Sales OL과 SCM OL 정확도를 비교해줘'];
function statusForRisk(risk: AgentActionResult['risk']) { return risk === 'LOW' ? 'SAFE' : risk === 'MEDIUM' ? 'WARNING' : risk === 'HIGH' ? 'CRITICAL' : 'CALCULATION_UNAVAILABLE'; }
function statusForVerdict(verdict: AgentActionResult['verdict']) { return verdict === 'SUPPORTED' ? 'SAFE' : verdict === 'CONTRADICTED' ? 'CRITICAL' : verdict === 'PARTIALLY_SUPPORTED' ? 'WARNING' : 'CALCULATION_UNAVAILABLE'; }

export default function ChatForm({ configured }: { configured: boolean }) {
  const [question, setQuestion] = useState('');
  const [state, dispatch] = useState(initialAgentState);
  const [isPending, startTransition] = useTransition();
  const submit = (value = question) => { const error = validateQuestion(value); dispatch((current) => agentReducer(current, { type: 'SUBMIT', question: value })); if (error || !configured) return; startTransition(async () => { try { const result = await askAgent(value.trim()); dispatch(() => agentReducer(initialAgentState, { type: 'SUCCESS', answer: result, trace: result.trace })); } catch { dispatch((current) => agentReducer(current, { type: 'FAILURE', error: 'AGENT_REQUEST_FAILED' })); } }); };
  return <div className="agent-shell">
    <Panel title="SCM Agent에게 질문하기" description="저장된 SCM 분석 결과를 근거로 답변합니다.">
      <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label htmlFor="agent-question" className="metric-label">질문</label>
        <div className="agent-form-row"><input id="agent-question" className="form-input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="예: 최근 출고량이 급증한 품목은?" disabled={!configured || isPending} /><button className="button primary" type="submit" disabled={!configured || isPending}>{isPending ? '분석 중…' : '질문하기'}</button></div>
        {!configured ? <p className="muted">OpenAI 설정이 없어 질문 기능을 사용할 수 없습니다.</p> : null}
        {state.status === 'error' ? <p className="text-danger">요청을 처리하지 못했습니다: {state.error}</p> : null}
      </form>
      <div className="agent-examples"><span className="metric-label">예시 질문</span>{examples.map((example) => <button className="button ghost" type="button" key={example} onClick={() => { setQuestion(example); submit(example); }} disabled={!configured || isPending}>{example}</button>)}</div>
    </Panel>
    {state.answer ? <AnswerCard result={{ ...state.answer, trace: state.trace }} /> : null}
  </div>;
}

function AnswerCard({ result }: { result: AgentActionResult }) {
  return <Panel title="Structured Answer" description={result.cannot_answer ? '계산 또는 근거가 부족해 답변할 수 없습니다.' : 'Tool 결과와 검증된 수치에 기반한 답변입니다.'}>
    <div className="agent-answer-heading"><Badge status={statusForVerdict(result.verdict)}>{result.verdict}</Badge><Badge status={statusForRisk(result.risk)}>Risk: {result.risk}</Badge></div>
    {result.cannot_answer ? <p className="text-danger">답변을 생성할 수 없습니다. <EmptyValue reasonCode={result.cannot_answer_reason ?? 'CALCULATION_UNAVAILABLE'} /></p> : <p className="agent-answer">{result.answer}</p>}
    {result.evidence.length ? <div className="agent-evidence-grid">{result.evidence.map((evidence, index) => <article className="card agent-evidence-tile" key={`${evidence.source}-${index}`}><strong>{evidence.metric ?? '근거'}</strong><p>{evidence.value ?? <EmptyValue />}</p>{evidence.interpretation ? <span className="muted">{evidence.interpretation}</span> : null}<span className="muted">출처: {evidence.source}</span></article>)}</div> : null}
    {result.recommended_action ? <div className="agent-meta"><strong>권고</strong><span>{result.recommended_action}</span></div> : null}
    <div className="agent-meta"><strong>데이터 기준시각</strong><span>{result.data_as_of ?? <EmptyValue reasonCode="NO_DATA_AS_OF" />}</span></div>
    {result.trace.length ? <details className="agent-trace"><summary>Tool trace ({result.trace.length})</summary><div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>Tool</th><th>상태</th><th>소요시간</th><th>사유</th></tr></thead><tbody>{result.trace.map((entry, index) => <tr key={`${entry.name}-${index}`}><td>{entry.name}</td><td><Badge status={entry.ok ? 'SAFE' : 'CRITICAL'}>{entry.ok ? '성공' : '실패'}</Badge></td><td>{entry.ms}ms</td><td>{entry.reason ?? '—'}</td></tr>)}</tbody></table></div></details> : null}
  </Panel>;
}
