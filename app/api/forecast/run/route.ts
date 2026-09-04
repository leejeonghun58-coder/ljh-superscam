import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { runBaselineForecast } from '@/lib/forecast/repository';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({})) as { note?: string };
    const runId = await runBaselineForecast(body.note);
    return NextResponse.json({ runId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Forecast 실행에 실패했습니다.' }, { status: 500 });
  }
}
