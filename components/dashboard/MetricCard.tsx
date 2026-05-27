interface Props {
  label: string
  value: string | number
  hint?: string
}

export default function MetricCard({ label, value, hint }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  )
}
