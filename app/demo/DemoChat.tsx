'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/shared/StatusBadge'
import UserAvatar from '@/components/shared/UserAvatar'
import MessageBubble from '@/components/chat/MessageBubble'
import { DEMO_USER, seed } from '@/lib/demo-data'
import type { Conversation, ConversationStatus, Message } from '@/lib/types'

const STATUS_ORDER: Record<ConversationStatus, number> = {
  offline_handoff: 0,
  waiting: 1,
  human_active: 2,
  bot_active: 3,
  resolved: 4,
  archived: 5,
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h} h`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

export default function DemoChat() {
  const initial = useMemo(() => seed(), [])
  const [conversations, setConversations] = useState<Conversation[]>(initial.conversations)
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>(initial.messagesByConv)
  const [selectedId, setSelectedId] = useState<string | null>(initial.conversations[0]?.id ?? null)

  const messages = selectedId ? messagesByConv[selectedId] ?? [] : []
  const selected = conversations.find((c) => c.id === selectedId) ?? null

  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const d = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (d !== 0) return d
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [conversations])

  const lastMessages = useMemo(() => {
    const map: Record<string, Message | undefined> = {}
    for (const cid of Object.keys(messagesByConv)) {
      const arr = messagesByConv[cid]
      map[cid] = arr[arr.length - 1]
    }
    return map
  }, [messagesByConv])

  const unresolved = conversations.filter((c) => c.status !== 'resolved').length

  function patchConv(id: string, patch: Partial<Conversation>) {
    setConversations((cs) =>
      cs.map((c) => (c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c))
    )
  }

  function takeOver(id: string) {
    patchConv(id, { status: 'human_active', assigned_to: DEMO_USER.id })
  }

  function resolve(id: string) {
    patchConv(id, { status: 'resolved' })
  }

  function sendMessage(content: string) {
    if (!selected) return
    const trimmed = content.trim()
    if (!trimmed) return
    const m: Message = {
      id: `demo-msg-${Date.now()}`,
      conversation_id: selected.id,
      sender_type: 'human',
      sender_name: DEMO_USER.display_name,
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessagesByConv((p) => ({ ...p, [selected.id]: [...(p[selected.id] ?? []), m] }))
    patchConv(selected.id, {})
  }

  function simulateNewAlert() {
    const id = `demo-new-${Date.now()}`
    const now = new Date().toISOString()
    const conv: Conversation = {
      id,
      hotel_id: 'demo-hotel',
      session_id: id,
      guest_name: 'Sara',
      channel: 'web',
      status: 'waiting',
      assigned_to: null,
      created_at: now,
      updated_at: now,
    }
    const m1: Message = {
      id: `${id}-m1`,
      conversation_id: id,
      sender_type: 'guest',
      sender_name: null,
      content: '¿Tenéis disponibilidad para este finde? Somos 4 personas.',
      created_at: now,
    }
    const m2: Message = {
      id: `${id}-m2`,
      conversation_id: id,
      sender_type: 'bot',
      sender_name: 'Bot',
      content: 'Voy a derivarte con recepción para confirmar disponibilidad.',
      created_at: now,
    }
    setConversations((cs) => [conv, ...cs])
    setMessagesByConv((p) => ({ ...p, [id]: [m1, m2] }))
    setSelectedId(id)
  }

  return (
    <div className="flex flex-col h-dvh">
      {/* Demo banner */}
      <div className="bg-warning text-warning-fg text-xs px-4 py-2 flex items-center justify-between border-b border-border">
        <span><strong>Modo demo</strong> · datos hardcodeados, sin Supabase, sin notificaciones reales</span>
        <Link href="/login" className="underline hover:no-underline">Ir al login real ›</Link>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold">BoosterApp</span>
          <span className="text-xs text-muted truncate">· {DEMO_USER.hotel_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={simulateNewAlert}
            className="text-xs rounded-md border border-border px-2 py-1 hover:bg-surface-alt"
          >
            Simular nueva alerta
          </button>
          <span className="text-sm text-muted hidden sm:inline">Hola, {DEMO_USER.display_name}</span>
        </div>
      </header>

      {/* Sub-header */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 text-xs text-muted">
        <span>{unresolved} sin resolver</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success-fg" aria-hidden />
          1 recepcionista (tú)
        </span>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* LEFT */}
        <aside
          className={[
            'md:w-[340px] md:border-r md:border-border bg-surface flex flex-col min-h-0',
            selectedId ? 'hidden md:flex' : 'flex flex-1',
          ].join(' ')}
        >
          <div className="hidden md:flex items-center justify-between px-4 py-2 border-b border-border text-xs text-muted">
            <span>Conversaciones</span>
            <span>{unresolved} sin resolver</span>
          </div>
          <ul className="divide-y divide-border overflow-y-auto">
            {sorted.map((c) => {
              const isSelected = c.id === selectedId
              const isWaiting = c.status === 'waiting'
              const last = lastMessages[c.id]
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={[
                      'w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors',
                      isWaiting ? 'border-l-4 border-l-danger-fg' : 'border-l-4 border-l-transparent',
                      isSelected ? 'bg-surface-alt' : 'bg-surface hover:bg-surface-alt',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{c.guest_name || 'Guest'}</span>
                      <span className="text-[11px] text-muted shrink-0">{formatRelative(c.updated_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted truncate">{last?.content ?? 'Sin mensajes aún'}</span>
                      <StatusBadge status={c.status} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* RIGHT */}
        <section
          className={[
            'flex-1 flex flex-col min-h-0',
            selectedId ? 'flex' : 'hidden md:flex',
          ].join(' ')}
        >
          {selected ? (
            <DemoThread
              conversation={selected}
              messages={messages}
              onBack={() => setSelectedId(null)}
              onTake={() => takeOver(selected.id)}
              onResolve={() => resolve(selected.id)}
              onSend={sendMessage}
            />
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted px-6 text-center">
              Selecciona una conversación para abrirla.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function DemoThread({
  conversation,
  messages,
  onBack,
  onTake,
  onResolve,
  onSend,
}: {
  conversation: Conversation
  messages: Message[]
  onBack: () => void
  onTake: () => void
  onResolve: () => void
  onSend: (content: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, conversation.id])

  const firstHumanIdx = messages.findIndex((m) => m.sender_type === 'human')
  const dividerBeforeIdx = firstHumanIdx > 0 ? firstHumanIdx : -1
  const dividerTs = dividerBeforeIdx > 0 ? messages[dividerBeforeIdx - 1].created_at : null

  const showTakeover = conversation.status === 'waiting'
  const showActive = conversation.status === 'human_active'
  const inputEnabled = showActive

  function submit() {
    if (!value.trim() || !inputEnabled) return
    onSend(value)
    setValue('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="md:hidden flex items-center justify-between border-b border-border bg-surface px-3 py-2">
        <button onClick={onBack} className="text-sm text-muted">‹ Volver</button>
        <span className="text-sm font-medium truncate">{conversation.guest_name || 'Guest'}</span>
        <span className="w-12" aria-hidden />
      </div>

      {showTakeover && (
        <div className="bg-danger text-danger-fg px-4 py-3 flex items-center justify-between gap-3 border-b border-border">
          <p className="text-sm font-medium">El bot ha derivado esta conversación — es tu turno</p>
          <button onClick={onTake} className="rounded-md bg-fg text-bg px-3 py-1.5 text-sm font-medium">
            Tomar el mando
          </button>
        </div>
      )}
      {showActive && (
        <div className="bg-info text-info-fg px-4 py-2 flex items-center justify-between border-b border-border">
          <span className="text-sm font-medium">Recepción activa</span>
          <button onClick={onResolve} className="text-xs underline hover:no-underline">Marcar como resuelto</button>
        </div>
      )}
      {conversation.status === 'resolved' && (
        <div className="bg-neutral text-neutral-fg px-4 py-2 border-b border-border text-sm">
          Conversación resuelta
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-bg">
        {messages.map((m, i) => (
          <div key={m.id}>
            {i === dividerBeforeIdx && dividerTs && (
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted">
                  Recepción notificada · {new Date(dividerTs).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <MessageBubble message={m} />
          </div>
        ))}
      </div>

      {conversation.status !== 'resolved' && (
        <div className="border-t border-border bg-surface p-3">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              disabled={!inputEnabled}
              placeholder={inputEnabled ? 'Escribe un mensaje…' : 'Toma el mando para responder'}
              className="flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-surface-alt disabled:text-muted"
            />
            <button
              onClick={submit}
              disabled={!inputEnabled || !value.trim()}
              className="rounded-md bg-primary text-primary-fg px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Suppress unused warnings for components imported only for type/UI parity
void UserAvatar
