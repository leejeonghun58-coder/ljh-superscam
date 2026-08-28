import ProcurementApp from '@/components/procurement-app';
import { type WorkflowStepId } from '@/lib/menu';

const WORKFLOW_STEPS: WorkflowStepId[] = ['dashboard', 'demand', 'supply', 'master', 'calculation', 'report'];

function getInitialStep(value: string | string[] | undefined): WorkflowStepId {
  const step = Array.isArray(value) ? value[0] : value;
  return WORKFLOW_STEPS.includes(step as WorkflowStepId) ? step as WorkflowStepId : 'dashboard';
}

export default async function LegacyWorkflowPage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const params = await searchParams;
  return <ProcurementApp initialStep={getInitialStep(params.step)} />;
}
