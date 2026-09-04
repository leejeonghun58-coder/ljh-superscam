import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import { getBacktestPerformances, getBacktestDetails, getBacktestRuns, getChampions } from '@/lib/backtest/repository';
import ComparisonView from './comparison-view';
export const dynamic = 'force-dynamic';
export default async function ModelComparisonPage() {
  const [runsResult, performances, details, champions] = await Promise.all([getBacktestRuns(), getBacktestPerformances(), getBacktestDetails(), getChampions()]);
  const error = runsResult.error ?? performances.error ?? details.error ?? champions.error;
  if (error) return <section className="analysis-page"><PageHeader eyebrow="MODEL COMPARISON" title="모델 비교" description="저장된 Forecast Result와 검증기간 Actual의 성능을 비교합니다." /><Panel><p className="text-danger">조회에 실패했습니다: {error}</p></Panel></section>;
  if (!runsResult.data.length) return <section className="analysis-page"><PageHeader eyebrow="MODEL COMPARISON" title="모델 비교" description="저장된 Forecast Result와 검증기간 Actual의 성능을 비교합니다." /><Panel><p className="empty-state">성공한 Backtest 결과가 없습니다. 관리자가 Backtest를 실행하세요.</p></Panel></section>;
  return <section className="analysis-page"><PageHeader eyebrow="MODEL COMPARISON" title="모델 비교" description="Forecast를 재실행하지 않고 저장된 결과만으로 검증기간 성능을 비교합니다." /><Panel title="Model Comparison" meta="저장 결과 조회"><ComparisonView performances={performances.rows} details={details.rows} runs={runsResult.data} champions={champions.data ?? []} /></Panel></section>;
}
