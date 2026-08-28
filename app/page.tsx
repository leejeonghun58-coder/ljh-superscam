import Link from 'next/link';
import AppShell from '@/components/shell/app-shell';
import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import InsightBanner from '@/components/ui/insight-banner';
import { requireUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function Page() { await requireUser(); return <AppShell><section className="analysis-page"><PageHeader title="전체 현황" description="월간 발주계획의 주요 상태와 분석 화면을 한곳에서 확인합니다." /><div className="kpi-grid"><KpiCard label="분석 화면" value="2" foot="리드타임 · 재고 소진" /><KpiCard label="데이터 상태" value={<Badge status="SAFE" />} foot="analytics 기준" tone="safe" /><KpiCard label="확인 필요" value={<Badge status="CALCULATION_UNAVAILABLE" />} foot="데이터 부족 항목" tone="warning" /><KpiCard label="현재 기준월" value="2026.09" foot="월간 발주계획" /></div><Panel title="분석 바로가기" meta="공통 디자인 시스템 적용"><div className="dashboard-links"><Link href="/analysis/leadtime" className="dashboard-link"><span><strong>리드타임 격차</strong><small>공급처별 표준값과 실제 P80 비교</small></span><span className="dashboard-link-arrow">→</span></Link><Link href="/analysis/stockout" className="dashboard-link"><span><strong>재고 소진 위험</strong><small>가용재고와 사용량 기반 위험 판정</small></span><span className="dashboard-link-arrow">→</span></Link></div></Panel><InsightBanner title="다음 작업">상세 발주 workflow는 레거시 경로 <Link href="/workflow">/workflow</Link>에서 계속 사용할 수 있습니다.</InsightBanner></section></AppShell>; }