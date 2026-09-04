'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/badge';
import DataTable, { type Column } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { DemandProfile, DemandType } from '@/lib/scm-model';

const demandTypes: Array<DemandType | 'ALL'> = ['ALL', 'SMOOTH', 'INTERMITTENT', 'ERRATIC', 'LUMPY'];
const typeLabels: Record<DemandType | 'ALL', string> = { ALL: '전체', SMOOTH: 'SMOOTH', INTERMITTENT: 'INTERMITTENT', ERRATIC: 'ERRATIC', LUMPY: 'LUMPY' };
const badgeStatus: Record<DemandType, 'SAFE' | 'WARNING' | 'CRITICAL'> = { SMOOTH: 'SAFE', INTERMITTENT: 'WARNING', ERRATIC: 'CRITICAL', LUMPY: 'WARNING' };

function metric(value: number | null, reason: string | null, digits = 2) {
  return value === null ? <EmptyValue reasonCode={reason ?? 'NOT_AVAILABLE'} /> : value.toFixed(digits);
}

export default function ProfileTable({ rows }: { rows: DemandProfile[] }) {
  const [type, setType] = useState<DemandType | 'ALL'>('ALL');
  const [availability, setAvailability] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => rows.filter((row) => {
    const matchesType = type === 'ALL' || row.demandType === type;
    const matchesAvailability = availability === 'ALL' || (availability === 'AVAILABLE' ? row.demandType !== null : row.demandType === null);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || row.itemId.toLowerCase().includes(query) || row.itemName.toLowerCase().includes(query);
    return matchesType && matchesAvailability && matchesSearch;
  }), [availability, rows, search, type]);
  const columns: Column<DemandProfile>[] = [
    { key: 'itemId', label: 'SKU' },
    { key: 'itemName', label: '품목명' },
    { key: 'adi', label: 'ADI', align: 'right', render: (row) => metric(row.adi, row.reasonCode) },
    { key: 'cvSquared', label: 'CV²', align: 'right', render: (row) => metric(row.cvSquared, row.reasonCode) },
    { key: 'zeroDemandRate', label: 'Zero-demand Rate', align: 'right', render: (row) => row.zeroDemandRate === null ? <EmptyValue reasonCode={row.reasonCode ?? 'NOT_AVAILABLE'} /> : `${(row.zeroDemandRate * 100).toFixed(1)}%` },
    { key: 'trend', label: 'Trend', align: 'right', render: (row) => metric(row.trend, row.reasonCode) },
    { key: 'demandType', label: 'Demand Type', render: (row) => row.demandType ? <Badge status={badgeStatus[row.demandType]}>{row.demandType}</Badge> : <Badge status="CALCULATION_UNAVAILABLE">계산 불가</Badge> },
    { key: 'seasonality', label: 'Seasonality', render: (row) => row.seasonality === null ? <EmptyValue reasonCode="INSUFFICIENT_PERIODS" /> : row.seasonality ? '있음' : '없음' },
    { key: 'reasonCode', label: 'Reason', render: (row) => row.reasonCode ? <span className="reason-code">{row.reasonCode}</span> : '—' },
  ];
  return <>
    <div className="profile-filters" aria-label="Demand Profile 필터">
      <label>Demand Type<select className="form-input" value={type} onChange={(event) => setType(event.target.value as DemandType | 'ALL')}>{demandTypes.map((item) => <option key={item} value={item}>{typeLabels[item]}</option>)}</select></label>
      <label>계산 상태<select className="form-input" value={availability} onChange={(event) => setAvailability(event.target.value as typeof availability)}><option value="ALL">전체</option><option value="AVAILABLE">계산 가능</option><option value="UNAVAILABLE">계산 불가</option></select></label>
      <label>SKU 검색<input className="form-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SKU 또는 품목명" /></label>
    </div>
    <p className="filter-result">조회 {filtered.length.toLocaleString()}건 / 전체 {rows.length.toLocaleString()}건</p>
    <DataTable columns={columns} rows={filtered} rowKey={(row) => row.itemId} empty="조건에 맞는 Demand Profile이 없습니다." />
  </>;
}
