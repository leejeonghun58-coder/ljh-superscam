export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';
export type ChatMessage = { role: ChatRole; content: string | null; name?: string; tool_call_id?: string; tool_calls?: LlmToolCall[] };
export type LlmToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type ChatTool = Record<string, unknown>;
export type ChatRequest = { messages: ChatMessage[]; tools?: ChatTool[]; tool_choice?: 'auto' | 'none' | Record<string, unknown>; temperature?: number; response_format?: Record<string, unknown> };
export type ChatResult = { message: ChatMessage | null; content: string | null; toolCalls: LlmToolCall[]; error: string | null };
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type LlmEnv = Partial<Record<'OPENAI_BASE_URL' | 'OPENAI_API_KEY' | 'OPENAI_MODEL', string>>;
export type LlmOptions = { env?: LlmEnv; fetch?: FetchLike; timeoutMs?: number };

const schemaFallbackModels = new Set<string>();
const temperatureFallbackModels = new Set<string>();

function errorResult(error: string): ChatResult { return { message: null, content: null, toolCalls: [], error }; }
function envValue(env: LlmEnv | NodeJS.ProcessEnv, key: keyof LlmEnv): string { return (env[key] ?? '').trim(); }
function parseMessage(payload: unknown): ChatResult { const choice = (payload as { choices?: Array<{ message?: unknown }> } | null)?.choices?.[0]; const message = choice?.message; if (!message || typeof message !== 'object') return errorResult('응답에 message가 없습니다.'); const raw = message as Record<string, unknown>; const toolCalls = Array.isArray(raw.tool_calls) ? raw.tool_calls.filter((call): call is LlmToolCall => { if (!call || typeof call !== 'object') return false; const value = call as Record<string, unknown>; const fn = value.function; return typeof value.id === 'string' && value.type === 'function' && !!fn && typeof fn === 'object' && typeof (fn as Record<string, unknown>).name === 'string' && typeof (fn as Record<string, unknown>).arguments === 'string'; }) : []; const normalized: ChatMessage = { role: raw.role === 'assistant' ? 'assistant' : 'assistant', content: typeof raw.content === 'string' || raw.content === null ? raw.content : null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) }; return { message: normalized, content: normalized.content, toolCalls, error: null }; }

async function readError(response: Response): Promise<string> { try { const body = await response.text(); if (!body) return `OpenAI 요청 실패 (${response.status})`; try { const parsed = JSON.parse(body) as { error?: { message?: string } }; return parsed.error?.message ?? body; } catch { return body; } } catch { return `OpenAI 요청 실패 (${response.status})`; } }

export async function callChatCompletion(request: ChatRequest, fetcher: FetchLike = fetch, options: LlmOptions = {}): Promise<ChatResult> {
  const baseUrl = envValue(options.env ?? process.env, 'OPENAI_BASE_URL'); const apiKey = envValue(options.env ?? process.env, 'OPENAI_API_KEY'); const model = envValue(options.env ?? process.env, 'OPENAI_MODEL');
  if (!baseUrl || !apiKey || !model) return errorResult('OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL 환경변수가 필요합니다.');
  const key = `${baseUrl}|${model}`; const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`; const basePayload: Record<string, unknown> = { model, messages: request.messages, temperature: request.temperature ?? 0 }; if (request.tools) { basePayload.tools = request.tools; basePayload.tool_choice = request.tool_choice ?? 'auto'; } else if (request.tool_choice) basePayload.tool_choice = request.tool_choice; if (request.response_format) basePayload.response_format = request.response_format;
  let payload = basePayload; let retried = false;
  while (true) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
    try { const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload), signal: controller.signal }); if (response.ok) { try { return parseMessage(await response.json()); } catch { return errorResult('응답 JSON을 파싱하지 못했습니다.'); } } const message = await readError(response); if (response.status === 400 && !retried && /temperature/i.test(message) && !temperatureFallbackModels.has(key) && 'temperature' in payload) { temperatureFallbackModels.add(key); retried = true; payload = { ...payload }; delete payload.temperature; continue; } if (response.status === 400 && !retried && payload.response_format && (payload.response_format as Record<string, unknown>).type === 'json_schema' && !schemaFallbackModels.has(key)) { schemaFallbackModels.add(key); retried = true; payload = { ...payload, response_format: { type: 'json_object' } }; continue; } return errorResult(message); } catch (error) { return error instanceof DOMException && error.name === 'AbortError' ? errorResult('OpenAI 요청 시간이 초과되었습니다.') : errorResult(error instanceof Error ? error.message : 'OpenAI 네트워크 요청에 실패했습니다.'); } finally { clearTimeout(timeout); }
  }
}

