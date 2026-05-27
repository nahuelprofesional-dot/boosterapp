'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import ConversationList from '@/components/chat/ConversationList'
import ConversationThread from '@/components/chat/ConversationThread'
import type { Conversation, ConversationStatus, Message } from '@/lib/types'

interface Props {
  currentUserId: string
  displayName: string
  hotelId: string
  vapidPublicKey: string
  role: 'admin' | 'receptionist'
}

const STATUS_ORDER: Record<ConversationStatus, number> = {
  offline_handoff: 0,
  waiting: 1,
  human_active: 2,
  bot_active: 3,
  resolved: 4,
  archived: 5,
}

type ConvView = 'active' | 'archived'

function sortConversations(a: Conversation, b: Conversation) {
  const orderDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  if (orderDiff !== 0) return orderDiff
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
}

export default function ChatClient({ currentUserId, displayName, hotelId, vapidPublicKey, role }: Props) {
  const router = useRouter()
  const search = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<ConvView>('active')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushReady, setPushReady] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported' | null>(null)
  const [receptionistsOnline, setReceptionistsOnline] = useState<Array<{ userId: string; displayName: string }>>([])
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null)

  // Track latest selectedId in a ref for use inside realtime callbacks.
  const selectedIdRef = useRef<string | null>(null)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('updated_at', { ascending: false })
        .limit(200)

      const list = (convs as Conversation[] | null) ?? []
      const convIds = list.map((c) => c.id)

      // Pull recent messages for these conversations so the list can show previews.
      let lastMap: Record<string, Message> = {}
      if (convIds.length) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(convIds.length * 4)
        for (const m of (msgs as Message[] | null) ?? []) {
          if (!lastMap[m.conversation_id]) lastMap[m.conversation_id] = m
        }
      }

      if (cancelled) return
      setConversations(list)
      setLastMessages(lastMap)
      setLoading(false)

      // Deep-link from notification: ?c=<id>
      const c = search.get('c')
      if (c && list.some((x) => x.id === c)) setSelectedId(c)
    })()
    return () => { cancelled = true }
    // hotelId is stable for the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId])

  // ── Realtime: conversations ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`conv-${hotelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `hotel_id=eq.${hotelId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Conversation
            setConversations((cs) => cs.filter((c) => c.id !== old.id))
            return
          }
          const row = payload.new as Conversation
          setConversations((cs) => {
            const existing = cs.find((c) => c.id === row.id)
            return existing
              ? cs.map((c) => (c.id === row.id ? row : c))
              : [row, ...cs]
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, hotelId])

  // ── Heartbeat: mirror presence to a DB row so the webhook can see it ──────
  // Only receptionists count toward "someone is online" for the handoff
  // decision. Admins are excluded by design — see Feature 2 spec.
  useEffect(() => {
    if (role !== 'receptionist') return
    let cancelled = false
    const ping = () => {
      fetch('/api/presence/ping', { method: 'POST' }).catch(() => {})
    }
    ping()
    const id = setInterval(() => { if (!cancelled) ping() }, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [role])

  // ── Presence: who's currently watching this hotel's chat ──────────────────
  useEffect(() => {
    const channel = supabase.channel(`presence:${hotelId}`, {
      config: { presence: { key: currentUserId } },
    })
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, Array<{ role?: string; displayName?: string }>>
      const seen = new Map<string, string>() // userId -> displayName
      for (const [userId, entries] of Object.entries(state)) {
        const rec = entries.find((e) => e.role === 'receptionist')
        if (rec) seen.set(userId, rec.displayName || 'Recepción')
      }
      setReceptionistsOnline(
        Array.from(seen.entries())
          .map(([userId, displayName]) => ({ userId, displayName }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
      )
    })
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role, displayName, at: Date.now() })
      }
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, hotelId, currentUserId, role, displayName])

  // ── Realtime: messages (RLS scopes to this hotel) ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('msg-all')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const m = payload.new as Message
          setLastMessages((prev) => ({ ...prev, [m.conversation_id]: m }))
          if (m.conversation_id === selectedIdRef.current) {
            setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]))
          }
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase])

  // ── Fetch messages for selected conversation ───────────────────────────────
  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedId)
        .order('created_at', { ascending: true })
      if (cancelled) return
      setMessages((data as Message[] | null) ?? [])
    })()
    return () => { cancelled = true }
  }, [selectedId, supabase])

  // ── Service worker registration + push subscription ────────────────────────
  const subscribePush = useCallback(async (reg: ServiceWorkerRegistration) => {
    if (!('PushManager' in window) || !vapidPublicKey) return
    const existing = await reg.pushManager.getSubscription()
    const sub =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }))
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    })
  }, [vapidPublicKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (!('Notification' in window)) {
      setNotifPermission('unsupported')
      setPushReady(true)
      return
    }

    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        swRegRef.current = reg

        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'open-conversation' && event.data.conversationId) {
            setSelectedId(event.data.conversationId)
          }
        })

        if (!('PushManager' in window) || !vapidPublicKey) {
          setNotifPermission(Notification.permission)
          setPushReady(true)
          return
        }

        let permission = Notification.permission
        if (permission === 'default') {
          permission = await Notification.requestPermission()
        }
        setNotifPermission(permission)
        if (permission !== 'granted') {
          setPushReady(true)
          return
        }

        await subscribePush(reg)
        setPushReady(true)
      } catch (err) {
        console.error(err)
        setPushError('No se pudo activar las notificaciones')
        setPushReady(true)
      }
    })()
  }, [vapidPublicKey, subscribePush])

  const handleEnableNotifications = useCallback(async () => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'denied') {
      // Browsers won't re-prompt once denied; nudge the user toward settings.
      alert('Las notificaciones están bloqueadas en este navegador. Actívalas desde el candado de la barra de direcciones y recarga la página.')
      return
    }
    try {
      const permission = await Notification.requestPermission()
      setNotifPermission(permission)
      if (permission === 'granted' && swRegRef.current) {
        await subscribePush(swRegRef.current)
      }
    } catch (err) {
      console.error(err)
      setPushError('No se pudo activar las notificaciones')
    }
  }, [subscribePush])

  // ── Derived state ──────────────────────────────────────────────────────────
  const visibleConversations = useMemo(() => {
    return conversations.filter((c) =>
      view === 'archived' ? c.status === 'archived' : c.status !== 'archived'
    )
  }, [conversations, view])

  const sortedConversations = useMemo(() => {
    return [...visibleConversations]
      .sort(sortConversations)
      .map((c) => ({ ...c, last_message: lastMessages[c.id] ?? null }))
  }, [visibleConversations, lastMessages])

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  )

  const unresolvedCount = useMemo(
    () => conversations.filter((c) => c.status !== 'resolved' && c.status !== 'archived').length,
    [conversations]
  )

  const archivedCount = useMemo(
    () => conversations.filter((c) => c.status === 'archived').length,
    [conversations]
  )

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    // Reflect in URL so reload/notification deep-link keeps working
    const params = new URLSearchParams(search.toString())
    params.set('c', id)
    router.replace(`/chat?${params.toString()}`, { scroll: false })
  }, [router, search])

  const handleBack = useCallback(() => {
    setSelectedId(null)
    const params = new URLSearchParams(search.toString())
    params.delete('c')
    router.replace(`/chat${params.size ? '?' + params.toString() : ''}`, { scroll: false })
  }, [router, search])

  // No-op: realtime UPDATE will flip the row; these just close any optimistic gap.
  const noop = useCallback(() => {}, [])

  // ── Layout ─────────────────────────────────────────────────────────────────
  const showNotifWarning = pushReady && (notifPermission === 'denied' || notifPermission === 'default')

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0">
      {/* Notifications-disabled warning */}
      {showNotifWarning && (
        <div className="flex items-center justify-between gap-3 border-b border-warning/40 bg-warning/15 px-4 py-2 text-xs text-warning-fg">
          <span>Las notificaciones están desactivadas — puede que pierdas alertas.</span>
          <button
            onClick={handleEnableNotifications}
            className="shrink-0 rounded-md bg-warning-fg/10 hover:bg-warning-fg/20 text-warning-fg font-medium px-3 py-1"
          >
            Activar
          </button>
        </div>
      )}

      {/* Sub-header with counts + presence + push state */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border bg-surface px-4 py-2 text-xs text-muted">
        <span className="shrink-0">{unresolvedCount} sin resolver</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          {receptionistsOnline.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-warning-fg">
              <span className="h-1.5 w-1.5 rounded-full bg-warning-fg" aria-hidden />
              Sin recepcionistas activas
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
              {receptionistsOnline.map((r) => (
                <span
                  key={r.userId}
                  className="inline-flex items-center gap-1.5 max-w-[160px]"
                  title={`${r.displayName} en línea`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-success-fg shrink-0" aria-hidden />
                  <span className="truncate text-fg">{r.displayName}</span>
                </span>
              ))}
            </div>
          )}
          {pushError && <span className="text-danger-fg">{pushError}</span>}
        </div>
      </div>

      {/* LEFT: list */}
      <aside
        className={[
          'md:w-[340px] md:border-r md:border-border bg-surface flex flex-col min-h-0',
          selectedId ? 'hidden md:flex' : 'flex flex-1',
        ].join(' ')}
      >
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-surface">
          <button
            onClick={() => { setView('active'); setSelectedId(null) }}
            className={[
              'flex-1 text-xs rounded-md px-3 py-1.5 font-medium transition-colors',
              view === 'active' ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            Activas {view !== 'archived' && unresolvedCount > 0 && (
              <span className="ml-1 opacity-80">({unresolvedCount})</span>
            )}
          </button>
          <button
            onClick={() => { setView('archived'); setSelectedId(null) }}
            className={[
              'flex-1 text-xs rounded-md px-3 py-1.5 font-medium transition-colors',
              view === 'archived' ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            Archivadas {archivedCount > 0 && (
              <span className="ml-1 opacity-80">({archivedCount})</span>
            )}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-sm text-muted">Cargando…</div>
          ) : (
            <ConversationList
              conversations={sortedConversations}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          )}
        </div>
      </aside>

      {/* RIGHT: thread */}
      <section
        className={[
          'flex-1 flex flex-col min-h-0',
          selectedId ? 'flex' : 'hidden md:flex',
        ].join(' ')}
      >
        {selected ? (
          <>
            <div className="md:hidden flex items-center justify-between border-b border-border bg-surface px-3 py-2">
              <button onClick={handleBack} className="text-sm text-muted">‹ Volver</button>
              <span className="text-sm font-medium truncate">{selected.guest_name || 'Guest'}</span>
              <span className="w-12" aria-hidden />
            </div>
            <ConversationThread
              conversation={selected}
              messages={messages}
              onTaken={noop}
              onResolved={noop}
            />
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-sm text-muted px-6 text-center">
            Selecciona una conversación para abrirla.
          </div>
        )}
      </section>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
