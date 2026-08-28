export default function Topbar({ title = '월간 발주계획' }: { title?: string }) {
  return <header className="app-topbar"><div><span className="topbar-kicker">MONTHLY PROCUREMENT CONTROL</span><strong>{title}</strong></div><div className="topbar-meta"><span className="live-badge">LIVE</span><span>기준월 <b>2026.09</b></span></div></header>;
}
