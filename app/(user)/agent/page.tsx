import { requireUser } from '@/lib/auth';
import PageHeader from '@/components/shell/page-header';
import { getDemandProfileRt, getShipmentTrend } from '@/lib/scm';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  await requireUser();
  const [{ rows: trends, error: trendError }, { rows: profiles, error: profileError }] = await Promise.all([getShipmentTrend(), getDemandProfileRt()]);
  const error = trendError ?? profileError;
  return <section className="analysis-page"><PageHeader eyebrow="AGENT" title="SCM Agent" description="실데이터 분석 결과를 바탕으로 공급망 질문을 준비합니다." />{error ? <div className="card"><p className="text-danger">조회에 실패했습니다.</p><p className="muted">{error}</p></div> : <div className="grid grid-2"><div className="card"><h3>출고 추이</h3><p className="metric-value">{trends.length}</p><p className="muted">조회된 품목·기간 행</p></div><div className="card"><h3>수요 프로파일</h3><p className="metric-value">{profiles.length}</p><p className="muted">조회된 품목 행</p></div></div>}</section>;
}
