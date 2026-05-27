'use client'

import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import TakeoverBanner from './TakeoverBanner'
import MessageInput from './MessageInput'
import type { Conversation, Message } from '@/lib/types'

interface Props {
  conversation: Conversation
  messages: Message[]
  onTaken: () => void
  onResolved: () => void
}

function formatHm(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function ConversationThread({ conversation, messages, onTaken, onResolved }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, conversation.id])

  // Find handoff divider — the first guest/bot message after which status went to waiting.
  // Heuristic for the MVP: the moment of handoff is the first message with sender_type
  // immediately preceding the conversation's first 'human' message, OR the timestamp at
  // which the conversation was last marked waiting. We approximate by inserting the
  // divider just before the first human message.
  const firstHumanIdx = messages.findIndex((m) => m.sender_type === 'human')
  const dividerBeforeIdx = firstHumanIdx > 0 ? firstHumanIdx : -1
  const dividerTs =
    dividerBeforeIdx > 0 ? messages[dividerBeforeIdx - 1].created_at : null

  const showTakeoverBanner = conversation.status === 'waiting' || conversation.status === 'offline_handoff'
  const showActiveBar = conversation.status === 'human_active'
  const inputEnabled = conversation.status === 'human_active'

  return (
    <div className="flex flex-col h-full">
      {showTakeoverBanner && (
        <TakeoverBanner conversationId={conversation.id} onTaken={onTaken} />
      )}
      {showActiveBar && (
        <div className="bg-info text-info-fg px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-border">
          <span className="text-sm font-medium">Recepción activa</span>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await fetch('/api/conversations/return-to-bot', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ conversationId: conversation.id }),
                })
                // Realtime UPDATE flips the conversation row; the input disables itself.
              }}
              className="text-xs underline hover:no-underline"
            >
              Devolver al bot
            </button>
            <button
              onClick={async () => {
                await fetch('/api/conversations/resolve', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ conversationId: conversation.id }),
                })
                onResolved()
              }}
              className="text-xs underline hover:no-underline"
            >
              Marcar como resuelto
            </button>
          </div>
        </div>
      )}
      {conversation.status === 'resolved' && (
        <div className="bg-neutral text-neutral-fg px-4 py-2 border-b border-border text-sm">
          Conversación resuelta
        </div>
      )}
      {conversation.status === 'archived' && (
        <div className="bg-surface-alt text-muted px-4 py-2 border-b border-border text-sm">
          Conversación archivada — solo lectura
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-bg">
        {messages.map((m, i) => (
          <div key={m.id}>
            {i === dividerBeforeIdx && dividerTs && (
              <div className="flex items-center gap-3 my-3" aria-label="Divisor de derivación">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted">
                  Recepción notificada · {formatHm(dividerTs)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <MessageBubble message={m} />
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-muted text-center py-8">Sin mensajes en esta conversación.</p>
        )}
      </div>

      {conversation.status !== 'resolved' && conversation.status !== 'archived' && (
        <MessageInput
          conversationId={conversation.id}
          disabled={!inputEnabled}
        />
      )}
    </div>
  )
}
