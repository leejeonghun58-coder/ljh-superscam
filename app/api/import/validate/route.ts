import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: '이전 Import API입니다. /api/admin/imports 경로를 사용하세요.' }, { status: 410 });
}

export async function GET() {
  return NextResponse.json({ error: '이전 Import API입니다. /api/admin/imports 경로를 사용하세요.' }, { status: 410 });
}