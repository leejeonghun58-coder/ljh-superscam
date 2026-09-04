import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { runBacktest } from '@/lib/backtest/repository';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json() as { forecastRunId?: string };
    if (!body.forecastRunId) return NextResponse.json({ error: 'forecastRunId가 필요합니다.' }, { status: 400 });
    const backtestRunId = await runBacktest(body.forecastRunId);
    return NextResponse.json({ backtestRunId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Backtest 실행에 실패했습니다.' }, { status: 500 });
  }
}
