import { formatUnavailable } from '@/lib/ui';

export default function EmptyValue({ reason, className = '' }: { reason?: string | null; className?: string }) {
  return <span className={`empty-value ${className}`.trim()}>{formatUnavailable(reason)}</span>;
}
