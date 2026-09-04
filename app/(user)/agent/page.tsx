import { requireUser } from '@/lib/auth';
import PageHeader from '@/components/shell/page-header';
import ChatForm from './chat-form';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  await requireUser();
  const configured = Boolean(process.env.OPENAI_BASE_URL?.trim() && process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim());
  return <section className="analysis-page"><PageHeader eyebrow="AGENT" title="SCM Agent" description="실데이터 분석 결과를 바탕으로 공급망 질문에 답변합니다." /><ChatForm configured={configured} /></section>;
}
