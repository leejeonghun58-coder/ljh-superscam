import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getBatch, getStagingRows, getValidationErrors } from '@/lib/import/repository';
function csvCell(value: unknown) { const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
export async function GET(request: Request) {
  try {
    await requireAdmin(); const batchId = new URL(request.url).searchParams.get('batchId'); if (!batchId) return NextResponse.json({ error: 'batchId가 필요합니다.' }, { status: 400 });
    const [batch, rows, errors] = await Promise.all([getBatch(batchId), getStagingRows(batchId, 100000), getValidationErrors(batchId)]);
    const originals = rows.map((row) => row.original_row as Record<string, unknown>); const headers = Array.from(new Set(originals.flatMap((row) => Object.keys(row))));
    const metaHeaders = ['row_number', 'error_code', 'error_message', 'severity']; const lines = [headers.concat(metaHeaders).map(csvCell).join(',')];
    for (const error of errors) { const index = rows.findIndex((row) => row.row_number === error.row_number); const original = originals[index] ?? {}; const values = headers.map((header) => original[header] ?? ''); lines.push(values.concat([error.row_number, error.error_code, error.error_message, error.severity]).map(csvCell).join(',')); }
    return new NextResponse(`\uFEFF${lines.join('\r\n')}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${encodeURIComponent(batch.file_name)}-errors.csv"` } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '오류 CSV 생성에 실패했습니다.' }, { status: 500 }); }
}
