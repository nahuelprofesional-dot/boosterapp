'use client'

import { useState } from 'react'

export default function TakeoverBanner({ conversationId, onTaken }: { conversationId: string; onTaken: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function take() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/conversations/take', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    })
    if (!res.ok) {
      setBusy(false)
      setError('No se pudo tomar la conversación')
      return
    }
    onTaken()
    setBusy(false)
  }

  return (
    <div className="bg-danger text-danger-fg px-4 py-3 flex items-center justify-between gap-3 border-b border-border">
      <p className="text-sm font-medium">
        El bot ha derivado esta conversación — es tu turno
      </p>
      <div className="flex items-center gap-3">
        {error && <span className="text-xs">{error}</span>}
        <button
          onClick={take}
          disabled={busy}
          className="rounded-md bg-fg text-bg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {busy ? 'Tomando…' : 'Tomar el mando'}
        </button>
      </div>
    </div>
  )
}
