import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const baseUrl = process.env.PYTHON_FORECAST_SERVICE_URL;
    const serviceKey = process.env.PYTHON_FORECAST_SERVICE_API_KEY;
    if (!baseUrl || !serviceKey) return NextResponse.json({ error: 'Python Forecast Service 환경변수가 설정되지 않았습니다.' }, { status: 503 });
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/forecast/run`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Key': serviceKey }, body: JSON.stringify(body), cache: 'no-store' });
    const payload = await response.json().catch(() => ({ error: 'Python 서비스 응답을 읽을 수 없습니다.' }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Python Forecast 실행에 실패했습니다.' }, { status: 500 }); }
}
