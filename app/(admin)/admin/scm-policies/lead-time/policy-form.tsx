'use client';
import { useState } from 'react';
export default function LeadTimePolicyForm() {
  const [supplierId, setSupplierId] = useState(''); const [days, setDays] = useState(''); const [reason, setReason] = useState(''); const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent) { event.preventDefault(); setMessage('저장 중...'); const response = await fetch('/api/scm-policies/lead-time', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ supplierId, plannedLeadTime: days === '' ? null : Number(days), reason }) }); const body = await response.json(); setMessage(response.ok ? '저장했습니다. 새로고침하면 적용값과 이력을 확인할 수 있습니다.' : body.error ?? '저장에 실패했습니다.'); }
  return <form className="button-row" onSubmit={submit}><input aria-label="공급처 ID" placeholder="Supplier ID" value={supplierId} onChange={e => setSupplierId(e.target.value)} required /><input aria-label="확정 Lead Time" placeholder="일수(비우면 확정 해제)" value={days} onChange={e => setDays(e.target.value)} type="number" min="0" /><input aria-label="변경 사유" placeholder="변경 사유" value={reason} onChange={e => setReason(e.target.value)} /><button className="button primary" type="submit">정책 저장</button><span className="muted">{message}</span></form>;
}
