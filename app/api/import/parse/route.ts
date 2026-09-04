import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getImportSchema, suggestColumnMapping } from '@/lib/import/schema';
import { parseImportFile } from '@/lib/import/parse';
import { createUploadBatch, getSavedColumnMappings, mapRow, saveColumnMappings, saveStagingRows } from '@/lib/import/repository';
import type { ImportMode, ImportType } from '@/lib/import/types';
const types = ['usage_history','inventory','item_master','supplier_master','purchase_order','goods_receipt','sales_order','business_event'];
const modes = ['append','upsert','replace'];
export async function POST(request: Request) {
  try {
    const context = await requireAdmin(); const form = await request.formData(); const file = form.get('file'); const type = String(form.get('importType') ?? ''); const mode = String(form.get('importMode') ?? 'append');
    if (!(file instanceof File) || !file.name) return NextResponse.json({ error: '파일을 선택해 주세요.' }, { status: 400 });
    if (!types.includes(type)) return NextResponse.json({ error: '지원하지 않는 Import Type입니다.' }, { status: 400 });
    if (!modes.includes(mode)) return NextResponse.json({ error: '지원하지 않는 Import Mode입니다.' }, { status: 400 });
    const importType = type as ImportType; const parsed = await parseImportFile(file, importType); const suggested = suggestColumnMapping(importType, parsed.headers); const saved = await getSavedColumnMappings(importType);
    const mapping = suggested.map((item) => { const previous = saved.find((entry) => entry.source_column === item.sourceColumn); return previous ? { ...item, targetColumn: previous.target_column, confidence: previous.confidence } : item; });
    const batch = await createUploadBatch({ fileName: file.name, importType, importMode: mode as ImportMode, uploadedBy: context.user.id, totalRows: parsed.rows.length });
    await saveStagingRows(batch.batchId, parsed.rows.map((row) => ({ originalRow: row.values, mappedRow: mapRow(row, mapping) })));
    await saveColumnMappings(importType, mapping, context.user.id);
    return NextResponse.json({ batchId: batch.batchId, sourceFormat: parsed.sourceFormat, headers: parsed.headers, mapping, fields: Object.keys(getImportSchema(importType).fields), preview: parsed.rows.slice(0, 50) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '파일 처리에 실패했습니다.' }, { status: 500 }); }
}
