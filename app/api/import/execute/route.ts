import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { importBatch } from '@/lib/import/repository';
export async function POST(request: Request) { try { await requireAdmin(); const { batchId } = await request.json() as { batchId?: string }; if (!batchId) return NextResponse.json({ error: 'batchId가 필요합니다.' }, { status: 400 }); await importBatch(batchId); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'import에 실패했습니다.' }, { status: 500 }); } }
