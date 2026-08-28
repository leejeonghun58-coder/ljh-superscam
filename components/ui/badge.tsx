import { STATUS_LABELS, type ScmStatus } from '@/lib/ui';

export default function Badge({ status, label }: { status: ScmStatus; label?: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{label ?? STATUS_LABELS[status]}</span>;
}
