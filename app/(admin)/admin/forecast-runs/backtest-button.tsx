'use client';
import { useState } from 'react';

export default function BacktestButton({ forecastRunId }: { forecastRunId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run() {
    setBusy(true); setMessage(null);
    try { const response = await fetch('/api/backtest/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forecastRunId }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setMessage(`완료: ${body.backtestRunId}`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Backtest 실행에 실패했습니다.'); } finally { setBusy(false); }
  }
  return <span><button className="button ghost" onClick={run} disabled={busy}>{busy ? '검증 중…' : 'Backtest'}</button>{message && <small className="muted"> {message}</small>}</span>;
}
