'use client'

import { useState } from 'react'

interface Props {
  conversationId: string
  disabled?: boolean
  placeholder?: string
}

export default function MessageInput({ conversationId, disabled, placeholder }: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    const content = value.trim()
    if (!content || sending || disabled) return
    setSending(true)
    setError(null)
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId, content }),
    })
    if (!res.ok) {
      setError('No se pudo enviar')
      setSending(false)
      return
    }
    setValue('')
    setSending(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="border-t border-border bg-surface p-3">
      {error && (
        <p className="text-xs text-danger-fg bg-danger rounded px-2 py-1 mb-2">{error}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || sending}
          placeholder={placeholder || (disabled ? 'Toma el mando para responder' : 'Escribe un mensaje…')}
          className="flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-surface-alt disabled:text-muted"
        />
        <button
          onClick={send}
          disabled={disabled || sending || !value.trim()}
          className="rounded-md bg-primary text-primary-fg px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
