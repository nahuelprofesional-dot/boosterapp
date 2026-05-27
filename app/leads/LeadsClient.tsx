'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Lead, LeadInterestLevel } from '@/lib/types'

const LEVEL_STYLES: Record<LeadInterestLevel, { label: string; chip: string }> = {
  alta:  { label: 'Alta',  chip: 'bg-danger  text-danger-fg' },
  media: { label: 'Media', chip: 'bg-warning text-warning-fg' },
  baja:  { label: 'Baja',  chip: 'bg-info    text-info-fg' },
}

export default function LeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleAnalyze() {
    setError(null); setInfo(null); setAnalyzing(true)
    try {
      const res = await fetch('/api/leads/analyze', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'No se pudo analizar')
      setInfo(`Analizadas ${body.scanned} conversaciones · ${body.detected} leads detectados`)
      const list = await fetch('/api/leads').then((r) => r.json())
      setLeads(list.leads ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Leads detectados</h1>
          <p className="text-sm text-muted">
            Huéspedes que mostraron interés en reservar pero no finalizaron la conversación.
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="rounded-md bg-primary text-primary-fg px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {analyzing ? 'Analizando…' : 'Analizar conversaciones'}
        </button>
      </header>

      {info && (
        <div className="rounded-md border border-success/40 bg-success/15 text-success-fg px-3 py-2 text-sm">
          {info}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-alt px-6 py-12 text-center text-sm text-muted">
          {analyzing
            ? 'Analizando conversaciones…'
            : 'Aún no hay leads detectados. Pulsa "Analizar conversaciones" para iniciar el primer escaneo.'}
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {leads.map((l) => {
            const style = LEVEL_STYLES[l.interest_level]
            return (
              <li
                key={l.id}
                className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium truncate">
                    {l.guest_name || 'Huésped sin nombre'}
                  </h3>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                    {style.label}
                  </span>
                </div>
                <p className="text-sm text-fg">{l.summary}</p>
                <dl className="text-xs text-muted space-y-0.5">
                  {l.dates_interest && (
                    <div><dt className="inline font-medium text-fg">Fechas: </dt><dd className="inline">{l.dates_interest}</dd></div>
                  )}
                  {l.room_type && (
                    <div><dt className="inline font-medium text-fg">Habitación: </dt><dd className="inline">{l.room_type}</dd></div>
                  )}
                </dl>
                <div className="mt-auto pt-2">
                  <Link
                    href={`/chat?c=${l.conversation_id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Abrir conversación →
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
