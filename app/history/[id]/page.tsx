import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AppHeader from '@/components/AppHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import MessageBubble from '@/components/chat/MessageBubble'
import type { ConversationStatus, Message } from '@/lib/types'

export const dynamic = 'force-dynamic'

function duration(startISO: string, endISO: string): string {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime()
  if (ms < 0) return '—'
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const remMin = mins % 60
  if (hours < 24) return remMin ? `${hours} h ${remMin} min` : `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

export default async function HistoryThreadPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, hotel_id, display_name, role')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/chat')

  const { data: hotel } = await supabase
    .from('hotels').select('name').eq('id', profile.hotel_id).single()

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, session_id, guest_name, channel, status, assigned_to, created_at, updated_at, hotel_id')
    .eq('id', params.id)
    .single()
  if (!conv) notFound()
  if (conv.hotel_id !== profile.hotel_id) notFound()

  const [{ data: msgs }, { data: handler }] = await Promise.all([
    supabase.from('messages')
      .select('*')
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: true }),
    conv.assigned_to
      ? supabase.from('users').select('display_name').eq('id', conv.assigned_to).single()
      : Promise.resolve({ data: null }),
  ])

  const status = conv.status as ConversationStatus
  const messages = (msgs as Message[] | null) ?? []
  const dur = status === 'resolved'
    ? duration(conv.created_at as string, conv.updated_at as string)
    : '—'

  return (
    <div className="flex flex-col h-dvh">
      <AppHeader
        title="BoosterApp"
        role={profile.role}
        displayName={profile.display_name}
        hotelName={hotel?.name as string | undefined}
      />
      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-3xl w-full mx-auto">
        <Link href="/history" className="text-xs text-muted hover:text-fg">‹ Volver al historial</Link>

        <header className="mt-3 mb-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{conv.guest_name || 'Guest'}</h1>
              <p className="text-xs text-muted">Iniciada el {new Date(conv.created_at as string).toLocaleString('es-ES')}</p>
            </div>
            <StatusBadge status={status} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted">Canal</dt>
              <dd className="text-fg">{conv.channel as string}</dd>
            </div>
            <div>
              <dt className="text-muted">Sesión</dt>
              <dd className="text-fg truncate" title={conv.session_id as string}>{conv.session_id as string}</dd>
            </div>
            <div>
              <dt className="text-muted">Atendió</dt>
              <dd className="text-fg">{handler?.display_name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Duración</dt>
              <dd className="text-fg">{dur}</dd>
            </div>
          </dl>
        </header>

        <div className="rounded-lg border border-border bg-surface px-4 py-3 mb-2 text-xs text-muted text-center">
          Vista de solo lectura · {messages.length} mensaje{messages.length === 1 ? '' : 's'}
        </div>
        <div className="space-y-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {messages.length === 0 && (
            <p className="text-sm text-muted text-center py-8">Sin mensajes en esta conversación.</p>
          )}
        </div>
      </main>
    </div>
  )
}
