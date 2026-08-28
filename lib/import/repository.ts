import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getImportSchema } from './schema.ts';
import { rowKey, validateRows } from './validate.ts';
import { assertImportReady } from './policy.ts';
import type { ColumnMapping, ImportMode, ImportType, MappedImportRow, ParsedRow, UploadBatch, ValidationResult } from './types.ts';

function ensure<T>(data: T | null, error: { message?: string } | null, message: string): T {
  if (error) throw new Error(error.message || message);
  if (data === null) throw new Error(message);
  return data;
}

export function mapRow(row: ParsedRow, mapping: ColumnMapping[]): MappedImportRow {
  const values: Record<string, string> = {};
  for (const item of mapping) if (item.targetColumn) values[item.targetColumn] = row.values[item.sourceColumn] ?? '';
  return { rowNumber: row.rowNumber, values };
}

export async function createUploadBatch(input: { fileName: string; importType: ImportType; importMode: ImportMode; uploadedBy: string; totalRows: number }) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').from('upload_batch').insert({ file_name: input.fileName, import_type: input.importType, import_mode: input.importMode, uploaded_by: input.uploadedBy, total_rows: input.totalRows, rollback_supported: input.importMode !== 'replace' }).select('batch_id,file_name,import_type,import_mode,total_rows,success_rows,warning_rows,error_rows,status,rollback_supported').single();
  const row = ensure(data as (UploadBatch & { batch_id: string }) | null, error, '업로드 batch 생성에 실패했습니다.');
  return { ...row, batchId: row.batch_id };
}

export async function saveStagingRows(batchId: string, rows: Array<{ originalRow: Record<string, string>; mappedRow: MappedImportRow }>) {
  if (!rows.length) return;
  const supabase = await createSupabaseServerClient();
  const payload = rows.map((row) => ({ batch_id: batchId, row_number: row.mappedRow.rowNumber, original_row: row.originalRow, mapped_row: row.mappedRow.values, validation_status: 'PENDING' }));
  const { error } = await supabase.schema('core').from('import_staging').insert(payload);
  if (error) throw new Error(`staging 저장에 실패했습니다: ${error.message}`);
}

export async function saveColumnMappings(type: ImportType, mappings: ColumnMapping[], userId: string) {
  const supabase = await createSupabaseServerClient();
  const payload = mappings.filter((item) => item.targetColumn).map((item) => ({ import_type: type, source_column: item.sourceColumn, target_column: item.targetColumn, confidence: item.confidence, confirmed_by: userId, confirmed_at: new Date().toISOString() }));
  if (!payload.length) return;
  const { error } = await supabase.schema('core').from('column_mapping').upsert(payload, { onConflict: 'import_type,source_column' });
  if (error) throw new Error(`컬럼 매핑 저장에 실패했습니다: ${error.message}`);
}

export async function getBatch(batchId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').from('upload_batch').select('*').eq('batch_id', batchId).maybeSingle();
  return ensure(data, error, 'batch를 찾을 수 없습니다.');
}

export async function validateBatch(batchId: string, mapping: ColumnMapping[]): Promise<ValidationResult> {
  const supabase = await createSupabaseServerClient();
  const batch = await getBatch(batchId);
  const { data: staged, error: stagingError } = await supabase.schema('core').from('import_staging').select('row_number,original_row').eq('batch_id', batchId).order('row_number');
  if (stagingError) throw new Error(`staging 조회에 실패했습니다: ${stagingError.message}`);
  const rows = (staged ?? []).map((row) => mapRow({ rowNumber: row.row_number, values: row.original_row as Record<string, string> }, mapping));
  const [{ data: items }, { data: suppliers }] = await Promise.all([
    supabase.schema('core').from('v_item_master').select('item_id'),
    supabase.schema('core').from('v_leadtime_effective').select('supplier_id'),
  ]);
  const result = validateRows({ type: batch.import_type as ImportType, rows, itemIds: new Set((items ?? []).map((item) => String(item.item_id).trim().toUpperCase().replace(/[\s\-_]/g, ''))), supplierIds: new Set((suppliers ?? []).map((item) => String(item.supplier_id).trim().toUpperCase().replace(/[\s\-_]/g, ''))) });
  const { error: clearError } = await supabase.schema('core').from('validation_error').delete().eq('batch_id', batchId);
  if (clearError) throw new Error(`기존 검증 오류 삭제에 실패했습니다: ${clearError.message}`);
  if (result.errors.length) {
    const { error } = await supabase.schema('core').from('validation_error').insert(result.errors.map((item) => ({ batch_id: batchId, row_number: item.rowNumber, field_name: item.fieldName, error_code: item.errorCode, error_message: item.errorMessage, severity: item.severity, original_value: item.originalValue })));
    if (error) throw new Error(`검증 오류 저장에 실패했습니다: ${error.message}`);
  }
  const { error: stagingUpdateError } = await supabase.schema('core').from('import_staging').upsert(result.rows.map((row) => ({ batch_id: batchId, row_number: row.rowNumber, original_row: staged?.find((item) => item.row_number === row.rowNumber)?.original_row ?? {}, mapped_row: row.values, validation_status: row.status })), { onConflict: 'batch_id,row_number' });
  if (stagingUpdateError) throw new Error(`검증 상태 저장에 실패했습니다: ${stagingUpdateError.message}`);
  const { error: batchUpdateError } = await supabase.schema('core').from('upload_batch').update({ success_rows: result.counts.success, warning_rows: result.counts.warning, error_rows: result.counts.error, status: 'VALIDATED' }).eq('batch_id', batchId);
  if (batchUpdateError) throw new Error(`batch 검증 상태 저장에 실패했습니다: ${batchUpdateError.message}`);
  return result;
}

export async function approveBatch(batchId: string, replaceConfirmed = false) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').rpc('approve_import_batch', { p_batch_id: batchId, p_replace_confirmed: replaceConfirmed });
  if (error) throw new Error(error.message);
}

export async function importBatch(batchId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').rpc('import_batch', { p_batch_id: batchId });
  if (error) throw new Error(error.message);
}

export async function rollbackBatch(batchId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').rpc('rollback_batch', { p_batch_id: batchId });
  if (error) throw new Error(error.message);
}

export async function getImportHistory(limit = 50) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').from('upload_batch').select('*').order('uploaded_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getValidationErrors(batchId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').from('validation_error').select('*').eq('batch_id', batchId).order('row_number').order('created_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStagingRows(batchId: string, limit = 100) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').from('import_staging').select('*').eq('batch_id', batchId).order('row_number').limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
