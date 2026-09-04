'use client';
import { useState } from 'react';

export default function RunButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run() {
    setBusy(true); setMessage(null);
    try { const response = await fetch('/api/forecast/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setMessage(`실행이 완료되었습니다: ${body.runId}`); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Forecast 실행에 실패했습니다.'); setBusy(false); }
  }
  return <div className="button-row"><button className="ui-button ui-button-primary" onClick={run} disabled={busy}>{busy ? '실행 중…' : 'SQL Baseline 실행'}</button>{message && <span className="muted">{message}</span>}</div>;
}
