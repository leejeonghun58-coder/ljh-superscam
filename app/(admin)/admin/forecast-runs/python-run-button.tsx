'use client';
import { useState } from 'react';

export default function PythonRunButton() {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function run() { setBusy(true); setMessage(null); try { const response = await fetch('/api/forecast/python/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setMessage(`완료: ${body.run_id ?? body.runId}`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Python Forecast 실행에 실패했습니다.'); } finally { setBusy(false); } }
  return <span><button className="button ghost" onClick={run} disabled={busy}>{busy ? 'Python 실행 중…' : 'Python Forecast 실행'}</button>{message && <span className="muted"> {message}</span>}</span>;
}
