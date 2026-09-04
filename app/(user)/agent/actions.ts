'use server';

import { requireUser } from '@/lib/auth';
import { runAgent, type AgentRunResult } from '@/lib/agent/orchestrator';
import type { ChatMessage } from '@/lib/agent/llm';

export type AgentActionResult = Omit<AgentRunResult, 'history'>;

export async function askAgent(question: string, history: ChatMessage[] = []): Promise<AgentActionResult> {
  const { profile } = await requireUser();
  const result = await runAgent({ question, user: profile.role, history });
  const { history: _history, ...safeResult } = result;
  return safeResult;
}
