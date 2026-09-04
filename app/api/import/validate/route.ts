import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getBatch, saveColumnMappings, validateBatch } from '@/lib/import/repository';
import type { ColumnMapping } from '@/lib/import/types';
export async function POST(request: Request) { try { const context = await requireAdmin(); const body = await request.json() as { batchId?: string; mapping?: ColumnMapping[] }; if (!body.batchId || !Array.isArray(body.mapping)) return NextResponse.json({ error: 'batchId와 mapping이 필요합니다.' }, { status: 400 }); const batch = await getBatch(body.batchId); await saveColumnMappings(batch.import_type, body.mapping, context.user.id); return NextResponse.json(await validateBatch(body.batchId, body.mapping)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '검증에 실패했습니다.' }, { status: 500 }); } }
