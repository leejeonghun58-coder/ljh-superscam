export type ImportType =
  | 'usage_history'
  | 'inventory'
  | 'item_master'
  | 'supplier_master'
  | 'purchase_order'
  | 'goods_receipt'
  | 'sales_order'
  | 'business_event';

export type ImportMode = 'append' | 'upsert' | 'replace';
export const IMPORT_MODES: ImportMode[] = ['append', 'upsert', 'replace'];
export type BatchStatus = 'STAGED' | 'VALIDATED' | 'APPROVED' | 'IMPORTED' | 'ROLLED_BACK' | 'FAILED';
export type ValidationSeverity = 'SUCCESS' | 'WARNING' | 'ERROR';
export type SourceFormat = 'CSV' | 'XLSX';

export type FieldType = 'text' | 'number' | 'date' | 'boolean';

export type FieldSpec = {
  type: FieldType;
  required?: boolean;
  allowNegative?: boolean;
  aliases: string[];
  storageColumn: string;
};

export type ColumnMapping = {
  sourceColumn: string;
  targetColumn: string | null;
  confidence: 'AUTO' | 'MANUAL' | 'UNMAPPED';
};

export type ImportSchema = {
  type: ImportType;
  targetTable: string;
  requiredFields: string[];
  naturalKey: string[];
  fields: Record<string, FieldSpec>;
};

export type ParsedRow = { rowNumber: number; values: Record<string, string> };
export type ParsedImport = { headers: string[]; rows: ParsedRow[]; sourceFormat: SourceFormat };
export type MappedImportRow = { rowNumber: number; values: Record<string, string> };

export type ValidationError = {
  batchId?: string;
  rowNumber: number;
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  severity: Exclude<ValidationSeverity, 'SUCCESS'>;
  originalValue: unknown;
};

export type ValidatedRow = MappedImportRow & { status: ValidationSeverity };
export type ValidationResult = {
  rows: ValidatedRow[];
  errors: ValidationError[];
  counts: { success: number; warning: number; error: number };
};

export type UploadBatch = {
  batchId: string;
  fileName: string;
  importType: ImportType;
  importMode: ImportMode;
  totalRows: number;
  successRows: number;
  warningRows: number;
  errorRows: number;
  status: BatchStatus;
  rollbackSupported: boolean;
};
