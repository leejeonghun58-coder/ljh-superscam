import { cannotAnswer, parseAgentAnswer, agentAnswerResponseFormat, type AgentAnswer } from './schema.ts';
import { mergeToolNumbers, validateAnswerNumbers } from './guardrail.ts';
import { type AgentTool, type ToolRole, type ToolResult } from './tools.ts';
import { callChatCompletion, type ChatMessage, type ChatRequest, type ChatResult } from './llm.ts';

export type AgentLlm = (request: ChatRequest) => Promise<ChatResult>;
export type AgentRequest = { question: string; user: ToolRole | { role: ToolRole }; history: ChatMessage[] };
export type AgentTraceEntry = { name: string; args: Record<string, unknown> | null; ok: boolean; ms: number; reason: string | null };
export type AgentRunResult = AgentAnswer & { trace: AgentTraceEntry[]; history: ChatMessage[] };
export type AgentOrchestratorOptions = { llm?: AgentLlm; tools?: AgentTool[]; now?: () => number; timeoutMs?: number };

const MAX_ROUNDS = 6;
const DEFAULT_TIMEOUT_MS = 60_000;
const jsonObjectResponseFormat = { type: 'json_object' };

function roleOf(user: AgentRequest['user']): ToolRole { return typeof user === 'string' ? user : user.role; }
function toolMessage(result: ToolResult): string { return JSON.stringify({ ok: result.ok, data: result.data, numbers: result.numbers, dataAsOf: result.dataAsOf, reason: result.reason }); }
function withTrace(answer: AgentAnswer, trace: AgentTraceEntry[], history: ChatMessage[]): AgentRunResult { return { ...answer, trace, history }; }
function cannot(reason: string, trace: AgentTraceEntry[], history: ChatMessage[]): AgentRunResult { return withTrace(cannotAnswer(reason), trace, history); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function schemaTypes(schemaType: string | string[]): string[] { return Array.isArray(schemaType) ? schemaType : [schemaType]; }
function matchesType(value: unknown, type: string): boolean { if (type === 'string') return typeof value === 'string'; if (type === 'number') return typeof value === 'number' && Number.isFinite(value); if (type === 'boolean') return typeof value === 'boolean'; if (type === 'null') return value === null; if (type === 'object') return isObject(value); if (type === 'array') return Array.isArray(value); return true; }
function validArguments(value: unknown, tool: AgentTool): value is Record<string, unknown> { if (!isObject(value)) return false; const properties = tool.parameters.properties; if (tool.parameters.additionalProperties === false && Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call(properties, key))) return false; if (tool.parameters.required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) return false; return Object.entries(value).every(([key, entry]) => { const definition = properties[key]; return !definition || schemaTypes(definition.type).some((type) => matchesType(entry, type)); }); }
function llmTools(tools: AgentTool[]): Record<string, unknown>[] { return tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })); }
async function within<T>(promise: Promise<T>, remaining: number): Promise<T | null> { if (remaining <= 0) return null; let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([promise, new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), remaining); })]); } finally { if (timer) clearTimeout(timer); } }

export async function runAgent(input: AgentRequest, options: AgentOrchestratorOptions = {}): Promise<AgentRunResult> {
  const history = [...input.history, { role: 'user', content: input.question } as ChatMessage];
  const trace: AgentTraceEntry[] = [];
  const tools = options.tools ?? (await import('./tools.ts')).agentTools;
  const llm = options.llm ?? ((request: ChatRequest) => callChatCompletion(request));
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const role = roleOf(input.user);
  let responseFormat: Record<string, unknown> = agentAnswerResponseFormat;
  const allowedNumbers: Record<string, number> = {};
  let regenerated = false;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const remaining = deadline - now();
    const request: ChatRequest = { messages: history, tools: llmTools(tools.filter((tool) => tool.roles.includes(role))), tool_choice: 'auto', response_format: responseFormat, temperature: 0 };
    let llmResult: ChatResult | null;
    try { llmResult = await within(llm(request), remaining); } catch { llmResult = { message: null, content: null, toolCalls: [], error: 'LLM_ERROR' }; }
    if (!llmResult) return cannot('AGENT_TIMEOUT', trace, history);
    if (llmResult.error) return cannot('LLM_ERROR', trace, history);
    if (llmResult.toolCalls.length === 0) {
      const parsedAnswer = parseAgentAnswer(llmResult.content);
      if (parsedAnswer.cannot_answer) return withTrace(parsedAnswer, trace, history);
      const validation = validateAnswerNumbers(parsedAnswer, allowedNumbers);
      if (validation.ok) return withTrace(parsedAnswer, trace, history);
      if (regenerated) return cannot('UNSUPPORTED_NUMERIC_CLAIM', trace, history);
      regenerated = true;
      history.push(llmResult.message ?? { role: 'assistant', content: llmResult.content });
      history.push({ role: 'user', content: '숫자 검증에 실패했습니다. 출처 없는 숫자를 제거하거나 Tool 근거와 일치하도록 한 번만 다시 답변하세요: ' + validation.unmatched.map((claim) => claim.raw).join(', ') });
      responseFormat = jsonObjectResponseFormat;
      continue;
    }

    const assistantMessage = llmResult.message ?? { role: 'assistant', content: llmResult.content, tool_calls: llmResult.toolCalls };
    history.push(assistantMessage);
    responseFormat = jsonObjectResponseFormat;
    for (const toolCall of llmResult.toolCalls) {
      const started = now();
      let args: Record<string, unknown> | null = null;
      let reason: string | null = null;
      let toolResult: ToolResult | null = null;
      const tool = tools.find((candidate) => candidate.name === toolCall.function.name);
      if (!tool || !tool.roles.includes(role)) reason = 'TOOL_NOT_ALLOWED';
      if (!reason) {
        try {
          const parsed: unknown = JSON.parse(toolCall.function.arguments);
          if (!validArguments(parsed, tool as AgentTool)) reason = 'INVALID_TOOL_ARGUMENTS';
          else args = parsed;
        } catch { reason = 'INVALID_TOOL_ARGUMENTS'; }
      }
      if (!reason && tool && args) {
        const remainingForTool = deadline - now();
        try { toolResult = await within(tool.run(args), remainingForTool); } catch { toolResult = null; }
        if (!toolResult) reason = 'AGENT_TIMEOUT';
        else if (!toolResult.ok) reason = toolResult.reason ?? 'TOOL_FAILED';
      }
      const ok = reason === null && toolResult?.ok === true;
      trace.push({ name: toolCall.function.name, args, ok, ms: Math.max(0, now() - started), reason });
      if (!ok) return cannot(reason ?? 'TOOL_FAILED', trace, history);
      const completedToolResult = toolResult as ToolResult;
      Object.assign(allowedNumbers, mergeToolNumbers(toolCall.function.name, completedToolResult.numbers));
      history.push({ role: 'tool', content: toolMessage(completedToolResult), tool_call_id: toolCall.id });
    }
    if (round === MAX_ROUNDS - 1) return cannot('TOOL_LOOP_LIMIT', trace, history);
  }
  return cannot('TOOL_LOOP_LIMIT', trace, history);
}

