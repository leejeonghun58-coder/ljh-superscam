'use client';
import { useState } from 'react';

export default function ModelToggle({ modelIds }: { modelIds: string[] }) {
  const [selected, setSelected] = useState(() => new Set(modelIds));
  return <div className="model-toggle">{modelIds.map((modelId) => <label key={modelId}><input type="checkbox" checked={selected.has(modelId)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(modelId)) next.delete(modelId); else next.add(modelId); return next; })} /> {modelId}</label>)}</div>;
}
