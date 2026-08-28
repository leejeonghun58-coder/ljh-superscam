import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { approveBatch } from '@/lib/import/repository';
export async function POST(request: Request) { try { await requireAdmin(); const { batchId, replaceConfirmed } = await request.json() as { batchId?: string; replaceConfirmed?: boolean }; if (!batchId) return NextResponse.json({ error: 'batchId가 필요합니다.' }, { status: 400 }); await approveBatch(batchId, replaceConfirmed === true); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '승인에 실패했습니다.' }, { status: 500 }); } }
