import type { AgentAnswer } from '@/lib/agent/schema';

export type AgentViewState = { status: 'idle' | 'submitting' | 'success' | 'error'; answer: AgentAnswer | null; trace: Array<{ name: string; args: Record<string, unknown> | null; ok: boolean; ms: number; reason: string | null }>; error: string | null };
export const initialAgentState: AgentViewState = { status: 'idle', answer: null, trace: [], error: null };
export type AgentStateAction = { type: 'SUBMIT'; question: string } | { type: 'SUCCESS'; answer: AgentAnswer; trace?: AgentViewState['trace'] } | { type: 'FAILURE'; error: string } | { type: 'RESET' };
export function validateQuestion(question: string): string | null { return question.trim() ? null : 'EMPTY_QUESTION'; }
export function agentReducer(state: AgentViewState, action: AgentStateAction): AgentViewState { switch (action.type) { case 'SUBMIT': { const error = validateQuestion(action.question); return error ? { ...state, status: 'error', error } : { ...state, status: 'submitting', answer: null, trace: [], error: null }; } case 'SUCCESS': return { status: 'success', answer: action.answer, trace: action.trace ?? [], error: null }; case 'FAILURE': return { ...state, status: 'error', error: action.error }; case 'RESET': return initialAgentState; } }
