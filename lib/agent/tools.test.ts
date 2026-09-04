import test from 'node:test';
import assert from 'node:assert/strict';
import { agentTools, emptyToolResult } from './tools.ts';

test('Agent Tool 이름은 유일하고 4개만 등록된다', () => { assert.equal(agentTools.length, 4); assert.equal(new Set(agentTools.map((tool) => tool.name)).size, 4); });
test('모든 Tool은 한국어 description, strict parameters, 역할 필터, run을 가진다', () => { for (const tool of agentTools) { assert.equal(typeof tool.description, 'string'); assert.equal(tool.parameters.type, 'object'); assert.equal(tool.parameters.additionalProperties, false); assert.deepEqual(tool.roles, ['USER', 'ADMIN']); assert.equal(typeof tool.run, 'function'); } });
test('Tool parameter schema는 모든 속성을 required로 둔다', () => { for (const tool of agentTools) { const keys = Object.keys(tool.parameters.properties); assert.deepEqual(tool.parameters.required, keys); } });
test('없는 품목은 0이 아니라 명시적 reason을 반환한다', () => { assert.deepEqual(emptyToolResult('ITEM_NOT_FOUND'), { ok: false, data: null, numbers: {}, dataAsOf: null, reason: 'ITEM_NOT_FOUND' }); });
test('Agent Tool 모듈은 Supabase를 직접 생성하지 않는다', async () => { const source = await import('node:fs/promises').then((fs) => fs.readFile('lib/agent/tools.ts', 'utf8')); assert.equal(source.includes('createSupabase' + 'ServerClient'), false); assert.equal(source.includes("await import('../scm.ts')"), true); });

