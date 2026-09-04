import type { AgentAnswer } from './schema.ts';

export type AgentConversation = {
  conversationId: string;
  userId: string;
  userEmail: string;
  title: string;
  startedAt: string;
  lastAt: string;
};

export type AgentMessage = {
  messageId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  answer: AgentAnswer | Record<string, unknown> | null;
  toolTrace: unknown;
  usage: unknown;
  guardrail: unknown;
  createdAt: string;
};

export type SaveTurnInput = {
  conversationId?: string | null;
  title?: string | null;
  question: string;
  answer: AgentAnswer | Record<string, unknown> | null;
  toolTrace?: unknown;
  usage?: unknown;
  guardrail?: unknown;
};

type QueryResult = { data: unknown; error: { message: string } | null };
type ConversationClient = {
  schema: (name: string) => {
    from: (table: string) => any;
    rpc: (name: string, args: Record<string, unknown>) => Promise<QueryResult>;
  };
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
function nullableString(value: unknown): string | null { return value === null || value === undefined ? null : String(value); }
function normalizeConversation(row: Record<string, unknown>): AgentConversation {
  return {
    conversationId: String(row.conversation_id), userId: String(row.user_id), userEmail: String(row.user_email ?? ''),
    title: String(row.title ?? '새 대화'), startedAt: String(row.started_at), lastAt: String(row.last_at),
  };
}
function normalizeMessage(row: Record<string, unknown>): AgentMessage {
  return {
    messageId: String(row.message_id), conversationId: String(row.conversation_id), role: row.role === 'assistant' ? 'assistant' : 'user',
    content: String(row.content ?? ''), answer: (row.answer ?? null) as AgentMessage['answer'], toolTrace: row.tool_trace ?? null,
    usage: row.usage ?? null, guardrail: row.guardrail ?? null, createdAt: String(row.created_at),
  };
}
async function defaultClient(): Promise<ConversationClient> {
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  return createSupabaseServerClient() as unknown as ConversationClient;
}

export function preserveAnswerOnSaveFailure<T>(answer: T, _error: string | null): T { return answer; }

export async function listConversations(limit = 50, client?: ConversationClient): Promise<{ rows: AgentConversation[]; error: string | null }> {
  try {
    const supabase = client ?? await defaultClient();
    const { data, error } = await supabase.schema('core').from('agent_conversation').select('*').order('last_at', { ascending: false }).limit(limit);
    if (error) return { rows: [], error: error.message };
    return { rows: ((data ?? []) as Record<string, unknown>[]).map(normalizeConversation), error: null };
  } catch (error) { return { rows: [], error: errorMessage(error, '대화 목록 조회에 실패했습니다.') }; }
}

export async function getConversationMessages(conversationId: string, client?: ConversationClient): Promise<{ rows: AgentMessage[]; error: string | null }> {
  try {
    const supabase = client ?? await defaultClient();
    const { data, error } = await supabase.schema('core').from('agent_message').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) return { rows: [], error: error.message };
    return { rows: ((data ?? []) as Record<string, unknown>[]).map(normalizeMessage), error: null };
  } catch (error) { return { rows: [], error: errorMessage(error, '대화 메시지 조회에 실패했습니다.') }; }
}

export async function saveTurn(input: SaveTurnInput, client?: ConversationClient): Promise<{ conversationId: string | null; error: string | null }> {
  try {
    const supabase = client ?? await defaultClient();
    const { data, error } = await supabase.schema('core').rpc('save_agent_turn', {
      p_conversation_id: input.conversationId ?? null, p_title: input.title ?? null, p_question: input.question,
      p_answer: input.answer, p_tool_trace: input.toolTrace ?? [], p_usage: input.usage ?? null, p_guardrail: input.guardrail ?? null,
    });
    if (error) return { conversationId: null, error: error.message };
    return { conversationId: data ? String(data) : null, error: null };
  } catch (error) { return { conversationId: null, error: errorMessage(error, '대화 저장에 실패했습니다.') }; }
}
