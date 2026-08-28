import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import { requireAdmin } from '@/lib/auth';
import { getImportHistory } from '@/lib/import/history';
import ImportForm from './import-form';
import HistoryTable from './history-table';
export const dynamic = 'force-dynamic';
export default async function DataManagementPage() {
  await requireAdmin(); let history: Array<Record<string, unknown>> = []; let historyError: string | null = null;
  try { history = await getImportHistory(); } catch (error) { historyError = error instanceof Error ? error.message : 'Import History 조회에 실패했습니다.'; }
  return <section className="analysis-page"><PageHeader eyebrow="ADMIN / DATA MANAGEMENT" title="데이터 적재 관리" description="CSV·XLSX를 검증하고 승인한 뒤 RAW 계층에 적재합니다." /><ImportForm /><Panel title="Import History" meta="최근 50개 batch">{historyError ? <p className="text-danger">조회에 실패했습니다: {historyError}</p> : history.length === 0 ? <p className="empty-state">아직 Import 이력이 없습니다.</p> : <HistoryTable initialItems={history as never[]} />}</Panel></section>;
}
