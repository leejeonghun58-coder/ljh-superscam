import type { FieldSpec, ColumnMapping, ImportSchema, ImportType } from './types.ts';

const text = (aliases: string[], required = false, storageColumn = ''): FieldSpec => ({ type: 'text', aliases, required, storageColumn });
const number = (aliases: string[], required = false, allowNegative = false, storageColumn = ''): FieldSpec => ({ type: 'number', aliases, required, allowNegative, storageColumn });
const date = (aliases: string[], required = false, storageColumn = ''): FieldSpec => ({ type: 'date', aliases, required, storageColumn });

export const IMPORT_SCHEMAS: Record<ImportType, ImportSchema> = {
  usage_history: {
    type: 'usage_history', targetTable: 'raw.usage_history', requiredFields: ['usage_id', 'item_id', 'use_date', 'qty'], naturalKey: ['usage_id'],
    fields: {
      usage_id: text(['usage_id', '사용량ID', '사용ID', '이력ID'], true, 'usage_id'),
      item_id: text(['item_id', 'item', '품목코드', '품목 ID'], true, 'item_id'),
      use_date: date(['use_date', '출고일', '사용일', '사용일자', 'date'], true, 'use_date'),
      qty: number(['qty', 'quantity', '출고수량', '사용수량', '수량'], true, true, 'qty'),
      warehouse: text(['warehouse', '창고', '출고창고'], false, 'warehouse'),
      note: text(['note', '비고', '메모'], false, 'note'),
    },
  },
  inventory: {
    type: 'inventory', targetTable: 'raw.inventory', requiredFields: ['item_id', 'warehouse', 'current_stock', 'as_of_date'], naturalKey: ['item_id', 'warehouse', 'as_of_date'],
    fields: {
      item_id: text(['item_id', 'item', '품목코드'], true, '품목코드'),
      warehouse: text(['warehouse', '창고', '입고창고'], true, '창고'),
      current_stock: number(['current_stock', 'stock', '현재고'], true, false, '현재고'),
      as_of_date: date(['as_of_date', '기준일자', '재고기준일', '기준일'], true, '기준일자'),
      safety_stock: number(['safety_stock', '안전재고'], false, false, '안전재고'),
    },
  },
  item_master: {
    type: 'item_master', targetTable: 'raw.item_master', requiredFields: ['item_id', 'item_name', 'active'], naturalKey: ['item_id'],
    fields: {
      item_id: text(['item_id', 'item', '품목코드'], true, '품목코드'),
      item_name: text(['item_name', '품목명', '자재명'], true, '품목명'),
      item_type: text(['item_type', '품목구분', '자재구분'], false, '품목구분'),
      unit: text(['unit', '단위'], false, '단위'),
      unit_price: number(['unit_price', '표준단가', '단가'], false, false, '표준단가'),
      active: text(['active', 'is_active', '사용여부'], true, '사용여부'),
      supplier_id: text(['supplier_id', '공급처', '공급업체코드'], false, 'supplier_id'),
    },
  },
  supplier_master: {
    type: 'supplier_master', targetTable: 'raw.supplier_master', requiredFields: ['supplier_id', 'supplier_name', 'active'], naturalKey: ['supplier_id'],
    fields: {
      supplier_id: text(['supplier_id', '공급업체코드', '공급처코드'], true, '공급업체코드'),
      supplier_name: text(['supplier_name', '공급업체명', '공급처명'], true, '공급업체명'),
      country: text(['country', '국가'], false, '국가'),
      standard_lead_time: number(['standard_lead_time', 'std_lead_time', '표준리드타임(일)', '표준리드타임'], false, false, '표준리드타임(일)'),
      manager: text(['manager', '담당자'], false, '담당자'),
      active: text(['active', 'is_active', '사용여부'], true, '사용여부'),
    },
  },
  purchase_order: {
    type: 'purchase_order', targetTable: 'raw.purchase_order', requiredFields: ['po_id', 'order_date', 'item_id', 'qty'], naturalKey: ['po_id'],
    fields: {
      po_id: text(['po_id', 'po_no', '발주번호', 'PO번호'], true, '발주번호'),
      order_date: date(['order_date', '발주일'], true, '발주일'),
      supplier_id: text(['supplier_id', 'supplier', '공급업체', '공급업체코드'], false, '공급업체'),
      item_id: text(['item_id', 'item', '품목코드'], true, '품목코드'),
      qty: number(['qty', 'quantity', '발주수량', '수량'], true, false, '발주수량'),
      unit_price: number(['unit_price', '단가'], false, false, '단가'),
      due_date: date(['due_date', '납기예정일', '납기일'], false, '납기예정일'),
      buyer: text(['buyer', '발주담당'], false, '발주담당'),
    },
  },
  goods_receipt: {
    type: 'goods_receipt', targetTable: 'raw.goods_receipt', requiredFields: ['receipt_id', 'po_id', 'item_id', 'qty', 'receipt_date'], naturalKey: ['receipt_id'],
    fields: {
      receipt_id: text(['receipt_id', '입고번호'], true, '입고번호'),
      po_id: text(['po_id', 'po_no', '발주번호'], true, '발주번호'),
      item_id: text(['item_id', 'item', '품목코드'], true, '품목코드'),
      qty: number(['qty', 'quantity', '입고수량', '수량'], true, false, '입고수량'),
      receipt_date: date(['receipt_date', '입고일'], true, '입고일'),
      warehouse: text(['warehouse', '입고창고', '창고'], false, '입고창고'),
    },
  },
  sales_order: {
    type: 'sales_order', targetTable: 'raw.sales_order', requiredFields: ['order_id', 'order_date', 'item_id', 'quantity'], naturalKey: ['order_id'],
    fields: {
      order_id: text(['order_id', '주문번호', '수주번호'], true, 'order_id'),
      order_date: date(['order_date', '주문일', '수주일'], true, 'order_date'),
      need_date: date(['need_date', '납품요청일', '필요일'], false, 'need_date'),
      item_id: text(['item_id', 'item', '품목코드'], true, 'item_id'),
      customer_id: text(['customer_id', '고객코드', '고객ID'], false, 'customer_id'),
      supplier_id: text(['supplier_id', '공급처', '공급업체코드'], false, 'supplier_id'),
      quantity: number(['quantity', 'qty', '주문수량', '수량'], true, false, 'quantity'),
      unit_price: number(['unit_price', '단가'], false, false, 'unit_price'),
      status: text(['status', '주문상태', '상태'], false, 'status'),
    },
  },
  business_event: {
    type: 'business_event', targetTable: 'raw.business_event', requiredFields: ['event_id', 'event_type', 'event_date'], naturalKey: ['event_id'],
    fields: {
      event_id: text(['event_id', 'event', '이벤트ID'], true, 'event_id'),
      event_type: text(['event_type', '이벤트유형', '이벤트구분'], true, 'event_type'),
      event_date: date(['event_date', '이벤트일', '발생일'], true, 'event_date'),
      item_id: text(['item_id', 'item', '품목코드'], false, 'item_id'),
      supplier_id: text(['supplier_id', '공급처', '공급업체코드'], false, 'supplier_id'),
      quantity: number(['quantity', 'qty', '수량'], false, false, 'quantity'),
      amount: number(['amount', '금액'], false, false, 'amount'),
      note: text(['note', '비고', '메모'], false, 'note'),
    },
  },
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-()]/g, '');
}

export function getImportSchema(type: ImportType) {
  return IMPORT_SCHEMAS[type];
}

export function suggestColumnMapping(type: ImportType, headers: string[]): ColumnMapping[] {
  const schema = getImportSchema(type);
  return headers.map((sourceColumn) => {
    const normalized = normalizeHeader(sourceColumn);
    const targetColumn = Object.entries(schema.fields).find(([, spec]) => spec.aliases.some((alias) => normalizeHeader(alias) === normalized))?.[0] ?? null;
    return { sourceColumn, targetColumn, confidence: targetColumn ? 'AUTO' : 'UNMAPPED' };
  });
}
