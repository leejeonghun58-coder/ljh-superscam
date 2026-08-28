import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { validateBatch } from '@/lib/import/repository';
import type { ColumnMapping } from '@/lib/import/types';
export async function POST(request: Request) { try { await requireAdmin(); const body = await request.json() as { batchId?: string; mapping?: ColumnMapping[] }; if (!body.batchId || !Array.isArray(body.mapping)) return NextResponse.json({ error: 'batchId와 mapping이 필요합니다.' }, { status: 400 }); return NextResponse.json(await validateBatch(body.batchId, body.mapping)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '검증에 실패했습니다.' }, { status: 500 }); } }
