// "Comparativa semanal" — esta semana vs semana pasada.
// All data is pre-computed on the server (see app/dashboard/page.tsx) so this
// component is pure markup.

export interface WeekStats {
  total: number
  botResolvedPct: number
  humanPct: number
  avgResponseMin: number | null
}

interface Props {
  thisWeek: WeekStats
  lastWeek: WeekStats
  daily: { lastWeek: number[]; thisWeek: number[] } // each length 7, Mon→Sun
  topKeywords: Array<{ label: string; count: number }>
}

function pctChange(now: number, prev: number): { arrow: '↑' | '↓' | '→'; label: string } {
  if (prev === 0 && now === 0) return { arrow: '→', label: '0%' }
  if (prev === 0)               return { arrow: '↑', label: '+∞' }
  const delta = ((now - prev) / prev) * 100
  if (Math.abs(delta) < 1) return { arrow: '→', label: '0%' }
  return delta > 0
    ? { arrow: '↑', label: `+${Math.round(delta)}%` }
    : { arrow: '↓', label: `${Math.round(delta)}%` }
}

function minutesChange(now: number | null, prev: number | null) {
  if (now == null && prev == null) return { arrow: '→' as const, label: '—' }
  if (now == null)  return { arrow: '→' as const, label: '—' }
  if (prev == null) return { arrow: '→' as const, label: '—' }
  return pctChange(now, prev)
}

function ComparisonCard({
  label,
  now,
  prev,
  change,
  hint,
}: {
  label: string
  now: string
  prev: string
  change: { arrow: '↑' | '↓' | '→'; label: string }
  hint?: string
}) {
  const arrowColor =
    change.arrow === '↑' ? 'text-success-fg' :
    change.arrow === '↓' ? 'text-danger-fg'  :
    'text-muted'
  return (
    <div className="rounded-lg border border-border bg-surface p-3 sm:p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-xl sm:text-2xl font-semibold">{now}</span>
        <span className={`text-xs font-medium ${arrowColor}`}>{change.arrow} {change.label}</span>
      </div>
      <div className="text-[11px] text-muted mt-1">
        Semana pasada: {prev}
      </div>
      {hint && <div className="text-[11px] text-muted mt-0.5">{hint}</div>}
    </div>
  )
}

const DAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function DailyComparisonChart({ lastWeek, thisWeek }: { lastWeek: number[]; thisWeek: number[] }) {
  const max = Math.max(1, ...lastWeek, ...thisWeek)
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted">Conversaciones por día</div>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-neutral-fg/40" aria-hidden /> Semana pasada
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-primary" aria-hidden /> Esta semana
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-3 h-32 items-end">
        {DAY_INITIALS.map((d, i) => {
          const prev = lastWeek[i] ?? 0
          const curr = thisWeek[i] ?? 0
          const prevPct = (prev / max) * 100
          const currPct = (curr / max) * 100
          return (
            <div key={i} className="flex flex-col items-center gap-1 h-full">
              <div className="flex-1 w-full flex items-end gap-1">
                <div
                  className="flex-1 rounded-sm bg-neutral-fg/40"
                  style={{ height: `${Math.max(prevPct, prev > 0 ? 6 : 0)}%` }}
                  title={`Semana pasada: ${prev}`}
                  aria-label={`Semana pasada ${d}: ${prev}`}
                />
                <div
                  className="flex-1 rounded-sm bg-primary"
                  style={{ height: `${Math.max(currPct, curr > 0 ? 6 : 0)}%` }}
                  title={`Esta semana: ${curr}`}
                  aria-label={`Esta semana ${d}: ${curr}`}
                />
              </div>
              <span className="text-[10px] text-muted">{d}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopKeywords({ items }: { items: Array<{ label: string; count: number }> }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-muted mb-3">Preguntas más frecuentes esta semana</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted py-4 text-center">
          Aún no hay datos suficientes esta semana.
        </div>
      ) : (
        <ol className="space-y-2">
          {items.map((it, i) => {
            const max = items[0].count
            const pct = (it.count / max) * 100
            return (
              <li key={it.label} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    <span className="text-muted mr-2">{i + 1}.</span>
                    {it.label}
                  </span>
                  <span className="text-xs text-muted">{it.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-alt overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export default function ComparisonSection({ thisWeek, lastWeek, daily, topKeywords }: Props) {
  const totalChange   = pctChange(thisWeek.total, lastWeek.total)
  const botChange     = pctChange(thisWeek.botResolvedPct, lastWeek.botResolvedPct)
  const humanChange   = pctChange(thisWeek.humanPct, lastWeek.humanPct)
  const responseChange = minutesChange(thisWeek.avgResponseMin, lastWeek.avgResponseMin)

  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold mb-3">Comparativa semanal</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ComparisonCard
          label="Total conversaciones"
          now={String(thisWeek.total)}
          prev={String(lastWeek.total)}
          change={totalChange}
        />
        <ComparisonCard
          label="Resueltas por el bot"
          now={`${thisWeek.botResolvedPct}%`}
          prev={`${lastWeek.botResolvedPct}%`}
          change={botChange}
        />
        <ComparisonCard
          label="Con intervención humana"
          now={`${thisWeek.humanPct}%`}
          prev={`${lastWeek.humanPct}%`}
          change={humanChange}
        />
        <ComparisonCard
          label="Tiempo medio de respuesta"
          now={thisWeek.avgResponseMin == null ? '—' : `${thisWeek.avgResponseMin} min`}
          prev={lastWeek.avgResponseMin == null ? '—' : `${lastWeek.avgResponseMin} min`}
          change={responseChange}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
        <div className="lg:col-span-2">
          <DailyComparisonChart lastWeek={daily.lastWeek} thisWeek={daily.thisWeek} />
        </div>
        <TopKeywords items={topKeywords} />
      </div>
    </section>
  )
}
