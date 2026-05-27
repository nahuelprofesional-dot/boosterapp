'use client'

import { useState } from 'react'

export default function DataClient({ initialArchivedCount }: { initialArchivedCount: number }) {
  const [count, setCount] = useState(initialArchivedCount)
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (count === 0) return
    const ok = confirm(
      `¿Borrar definitivamente ${count} conversación${count === 1 ? '' : 'es'} archivada${count === 1 ? '' : 's'}? Esta acción no se puede deshacer.`
    )
    if (!ok) return
    setError(null)
    setStatus(null)
    setDeleting(true)
    try {
      const res = await fetch('/api/conversations/archived', { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'No se pudo borrar')
      setCount(0)
      setStatus(`Se borraron ${body.deleted} conversaciones archivadas.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium mb-1">Conversaciones archivadas</h2>
        <p className="text-xs text-muted mb-3">
          Las conversaciones resueltas hace más de 7 días se archivan automáticamente.
          Aquí puedes borrarlas de forma permanente para liberar espacio.
        </p>

        {status && (
          <div className="mb-3 rounded-md border border-success/40 bg-success/15 text-success-fg px-3 py-2 text-sm">
            {status}
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-md border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">
            <span className="font-medium">{count}</span>{' '}
            archivada{count === 1 ? '' : 's'} actualmente.
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting || count === 0}
            className="rounded-md bg-danger text-danger-fg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {deleting ? 'Borrando…' : 'Borrar conversaciones archivadas'}
          </button>
        </div>
      </section>
    </div>
  )
}
