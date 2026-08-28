import EmptyValue from './empty-value';

export default function FormatNumber({ value, suffix = '', reason }: { value: number | null | undefined; suffix?: string; reason?: string | null }) {
  if (value === null || value === undefined) return <EmptyValue reason={reason} />;
  return <>{Number.isInteger(value) ? value : value.toFixed(1)}{suffix}</>;
}
