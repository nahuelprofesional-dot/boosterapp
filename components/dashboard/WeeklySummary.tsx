'use client'

import { useState } from 'react'

interface SummaryResult {
  summary: string
  metrics?: {
    totalConversations: number
    resolvedByBotPct: number | null
    requiredHumanPct: number | null
  }
}

export default function WeeklySummary() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SummaryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setError(null); setLoading(true); setOpen(true)
    try {
      const res = await fetch('/api/dashboard/weekly-summary', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'No se pudo generar el resumen')
      setResult({ summary: body.summary, metrics: body.metrics })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Resumen de la semana</h2>
          <p className="text-xs text-muted">Análisis automático con IA de los últimos 7 días.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(result || error) && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-xs text-muted hover:text-fg"
            >
              {open ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-md bg-primary text-primary-fg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {loading ? 'Generando…' : result ? 'Regenerar' : 'Resumen de la semana'}
          </button>
        </div>
      </header>

      {open && (
        <div className="px-4 py-4 space-y-3 text-sm">
          {loading && !result && !error && (
            <p className="text-muted">Analizando conversaciones de los últimos 7 días…</p>
          )}
          {error && (
            <div className="rounded-md border border-danger/40 bg-danger/10 text-danger px-3 py-2">
              {error}
            </div>
          )}
          {result && !error && (
            <MarkdownLite text={result.summary} />
          )}
        </div>
      )}
    </section>
  )
}

// Minimal Markdown → React renderer for the limited subset Claude outputs:
// `## headings` and `- bullets`. Anything else falls through as plain text.
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split(/\r?\n/)
  const out: React.ReactNode[] = []
  let bullets: string[] = []

  function flushBullets() {
    if (bullets.length === 0) return
    out.push(
      <ul key={`u-${out.length}`} className="list-disc pl-5 space-y-1">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    )
    bullets = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushBullets(); continue }
    if (line.startsWith('## ')) {
      flushBullets()
      out.push(<h3 key={`h-${out.length}`} className="text-sm font-semibold mt-3 first:mt-0">{line.slice(3).trim()}</h3>)
      continue
    }
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2).trim())
      continue
    }
    flushBullets()
    out.push(<p key={`p-${out.length}`}>{line}</p>)
  }
  flushBullets()
  return <div className="space-y-1">{out}</div>
}
