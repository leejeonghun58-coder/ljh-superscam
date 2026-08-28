import { getImportSchema } from './schema.ts';
import type { ImportType, MappedImportRow, ValidationError, ValidationResult, ValidatedRow } from './types.ts';

type ValidationInput = {
  type: ImportType;
  rows: MappedImportRow[];
  existingKeys?: Set<string>;
  itemIds?: Set<string>;
  supplierIds?: Set<string>;
};

function canonical(value: string) {
  return value.trim().toUpperCase().replace(/[\s\-_]/g, '');
}

function required(value: string | undefined) {
  return value === undefined || value.trim() === '';
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(/,/g, '').trim());
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

function makeError(rowNumber: number, fieldName: string, errorCode: string, errorMessage: string, originalValue: unknown, severity: 'ERROR' | 'WARNING' = 'ERROR'): ValidationError {
  return { rowNumber, fieldName, errorCode, errorMessage, originalValue, severity };
}

export function rowKey(type: ImportType, values: Record<string, string>) {
  return getImportSchema(type).naturalKey.map((field) => canonical(values[field] ?? '')).join('|');
}

export function validateRows(input: ValidationInput): ValidationResult {
  const schema = getImportSchema(input.type);
  const errors: ValidationError[] = [];
  const seen = new Set<string>();
  const rows: ValidatedRow[] = input.rows.map((row) => {
    const rowErrors: ValidationError[] = [];
    for (const field of schema.requiredFields) {
      if (required(row.values[field])) rowErrors.push(makeError(row.rowNumber, field, 'REQUIRED_VALUE_MISSING', `필수값이 비어 있습니다: ${field}`, row.values[field] ?? null));
    }
    for (const [field, spec] of Object.entries(schema.fields)) {
      const value = row.values[field];
      if (required(value)) continue;
      if (spec.type === 'number') {
        const parsed = parseNumber(value);
        if (parsed === null) rowErrors.push(makeError(row.rowNumber, field, 'INVALID_NUMBER', `숫자 형식이 아닙니다: ${value}`, value));
        else if (parsed < 0 && !spec.allowNegative) rowErrors.push(makeError(row.rowNumber, field, 'NEGATIVE_NOT_ALLOWED', `음수 값을 허용하지 않습니다: ${value}`, value));
      }
      if (spec.type === 'date' && !isDate(value)) rowErrors.push(makeError(row.rowNumber, field, 'INVALID_DATE', `날짜 형식이 올바르지 않습니다(YYYY-MM-DD): ${value}`, value));
    }
    const key = rowKey(input.type, row.values);
    if (key !== '' && seen.has(key)) rowErrors.push(makeError(row.rowNumber, schema.naturalKey.join(','), 'DUPLICATE_KEY', '파일 내부에 중복 키가 있습니다.', key));
    if (key !== '') seen.add(key);
    if (input.existingKeys?.has(key)) rowErrors.push(makeError(row.rowNumber, schema.naturalKey.join(','), 'DUPLICATE_KEY', '기존 데이터와 키가 중복됩니다.', key, 'WARNING'));
    const itemId = row.values.item_id;
    if (input.itemIds && input.type !== 'item_master' && !required(itemId) && !input.itemIds.has(canonical(itemId))) rowErrors.push(makeError(row.rowNumber, 'item_id', 'UNKNOWN_ITEM', `등록되지 않은 품목입니다: ${itemId}`, itemId));
    const supplierId = row.values.supplier_id;
    if (input.supplierIds && input.type !== 'supplier_master' && !required(supplierId) && !input.supplierIds.has(canonical(supplierId))) rowErrors.push(makeError(row.rowNumber, 'supplier_id', 'UNKNOWN_SUPPLIER', `등록되지 않은 공급처입니다: ${supplierId}`, supplierId));
    if (input.type === 'purchase_order' && row.values.order_date && row.values.due_date && isDate(row.values.order_date) && isDate(row.values.due_date) && row.values.due_date < row.values.order_date) rowErrors.push(makeError(row.rowNumber, 'due_date', 'DATE_ORDER_INVALID', '납기예정일이 발주일보다 빠릅니다.', row.values.due_date));
    if (input.type === 'sales_order' && row.values.order_date && row.values.need_date && isDate(row.values.order_date) && isDate(row.values.need_date) && row.values.need_date < row.values.order_date) rowErrors.push(makeError(row.rowNumber, 'need_date', 'DATE_ORDER_INVALID', '필요일이 주문일보다 빠릅니다.', row.values.need_date));
    errors.push(...rowErrors);
    return { ...row, status: rowErrors.some((error) => error.severity === 'ERROR') ? 'ERROR' : rowErrors.length ? 'WARNING' : 'SUCCESS' };
  });
  return {
    rows,
    errors,
    counts: {
      success: rows.filter((row) => row.status === 'SUCCESS').length,
      warning: rows.filter((row) => row.status === 'WARNING').length,
      error: rows.filter((row) => row.status === 'ERROR').length,
    },
  };
}
