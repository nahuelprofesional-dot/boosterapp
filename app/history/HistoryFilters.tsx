'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Filters {
  from: string
  to: string
  status: string
  receptionist: string
  q: string
}

interface Props {
  filters: Filters
  receptionists: Array<{ id: string; name: string }>
}

export default function HistoryFilters({ filters, receptionists }: Props) {
  const router = useRouter()
  const search = useSearchParams()
  const [local, setLocal] = useState<Filters>(filters)

  // Sync if URL changes externally.
  useEffect(() => { setLocal(filters) }, [filters.from, filters.to, filters.status, filters.receptionist, filters.q])

  function commit(next: Partial<Filters>) {
    const merged = { ...local, ...next }
    setLocal(merged)
    const params = new URLSearchParams(search.toString())
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    router.replace(`/history?${params.toString()}`, { scroll: false })
  }

  function clear() {
    setLocal({ from: '', to: '', status: '', receptionist: '', q: '' })
    router.replace('/history', { scroll: false })
  }

  const hasActiveFilters = Object.values(local).some((v) => v)

  return (
    <section className="rounded-lg border border-border bg-surface p-3 sm:p-4 space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block text-xs">
          <span className="block mb-1 text-muted">Desde</span>
          <input
            type="date"
            value={local.from}
            onChange={(e) => commit({ from: e.target.value })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block text-xs">
          <span className="block mb-1 text-muted">Hasta</span>
          <input
            type="date"
            value={local.to}
            onChange={(e) => commit({ to: e.target.value })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block text-xs">
          <span className="block mb-1 text-muted">Estado</span>
          <select
            value={local.status}
            onChange={(e) => commit({ status: e.target.value })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos</option>
            <option value="bot_active">Bot activo</option>
            <option value="waiting">En espera</option>
            <option value="offline_handoff">Pendientes de retomar</option>
            <option value="human_active">Recepción activa</option>
            <option value="resolved">Resueltas</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="block mb-1 text-muted">Recepción</span>
          <select
            value={local.receptionist}
            onChange={(e) => commit({ receptionist: e.target.value })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Cualquiera</option>
            {receptionists.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="search"
          value={local.q}
          onChange={(e) => setLocal((l) => ({ ...l, q: e.target.value }))}
          onBlur={() => commit({ q: local.q })}
          onKeyDown={(e) => { if (e.key === 'Enter') commit({ q: local.q }) }}
          placeholder="Buscar en mensajes…"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {hasActiveFilters && (
          <button type="button" onClick={clear} className="text-xs text-muted hover:text-fg">
            Limpiar
          </button>
        )}
      </div>
    </section>
  )
}
