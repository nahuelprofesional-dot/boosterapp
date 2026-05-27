interface Props {
  buckets: number[] // length 24, count per hour
}

export default function HourlyChart({ buckets }: Props) {
  const max = Math.max(1, ...buckets)
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-muted mb-3">Conversaciones por hora · Hoy</div>
      <div className="flex items-end gap-1 h-32">
        {buckets.map((v, i) => {
          const pct = (v / max) * 100
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-sm bg-primary/80"
                style={{ height: `${Math.max(pct, v > 0 ? 4 : 0)}%` }}
                title={`${i}:00 — ${v}`}
                aria-label={`${i}:00 — ${v}`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted mt-2">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  )
}
