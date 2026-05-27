import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AppHeader from '@/components/AppHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import HistoryFilters from './HistoryFilters'
import type { ConversationStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface SearchParams {
  from?: string
  to?: string
  status?: string
  receptionist?: string
  q?: string
}

function durationLabel(startISO: string, endISO: string): string {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime()
  if (ms < 0) return '—'
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const remMin = mins % 60
  if (hours < 24) return remMin ? `${hours} h ${remMin} min` : `${hours} h`
  const days = Math.floor(hours / 24)
  const remH = hours % 24
  return remH ? `${days} d ${remH} h` : `${days} d`
}

const VALID_STATUS: ConversationStatus[] = ['bot_active', 'waiting', 'offline_handoff', 'human_active', 'resolved']

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
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

  const { data: hotel } = await supabase.from('hotels').select('id, name').eq('id', profile.hotel_id).single()
  const { data: hotelUsers } = await supabase
    .from('users')
    .select('id, display_name, role')
    .eq('hotel_id', profile.hotel_id)
    .order('display_name')

  const filters = {
    from: searchParams.from ?? '',
    to: searchParams.to ?? '',
    status: VALID_STATUS.includes(searchParams.status as ConversationStatus) ? (searchParams.status as ConversationStatus) : '',
    receptionist: searchParams.receptionist ?? '',
    q: (searchParams.q ?? '').trim(),
  }

  // 1. If text search is active, find matching conversation ids first.
  let textMatchIds: Set<string> | null = null
  if (filters.q) {
    const { data: hits } = await supabase
      .from('messages')
      .select('conversation_id, content, conversations!inner(hotel_id)')
      .ilike('content', `%${filters.q}%`)
      .eq('conversations.hotel_id', profile.hotel_id)
      .limit(2000)
    textMatchIds = new Set((hits ?? []).map((h) => h.conversation_id as string))
  }

  // 2. Build conversation query with filters.
  let q = supabase
    .from('conversations')
    .select('id, session_id, guest_name, channel, status, assigned_to, created_at, updated_at')
    .eq('hotel_id', profile.hotel_id)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(200)

  if (filters.from) q = q.gte('created_at', new Date(filters.from).toISOString())
  if (filters.to) {
    const to = new Date(filters.to)
    to.setHours(23, 59, 59, 999)
    q = q.lte('created_at', to.toISOString())
  }
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.receptionist) q = q.eq('assigned_to', filters.receptionist)
  if (textMatchIds) {
    const ids = Array.from(textMatchIds)
    if (ids.length === 0) {
      // No matches at all — short circuit.
      return renderEmpty()
    }
    q = q.in('id', ids)
  }

  const { data: conversations } = await q
  const userMap = new Map((hotelUsers ?? []).map((u) => [u.id as string, u.display_name as string]))

  function renderEmpty() {
    return (
      <div className="flex flex-col h-dvh">
        <AppHeader title="BoosterApp" role={profile!.role} displayName={profile!.display_name} hotelName={hotel?.name} />
        <main className="flex-1 overflow-y-auto px-4 py-6 max-w-5xl w-full mx-auto">
          <h1 className="text-lg font-semibold mb-1">Historial</h1>
          <p className="text-sm text-muted mb-5">Búsqueda y filtrado de conversaciones (no archivadas).</p>
          <HistoryFilters filters={filters} receptionists={(hotelUsers ?? []).map((u) => ({ id: u.id as string, name: u.display_name as string }))} />
          <p className="text-sm text-muted mt-8 text-center">Sin resultados para la búsqueda actual.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh">
      <AppHeader title="BoosterApp" role={profile.role} displayName={profile.display_name} hotelName={hotel?.name} />
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-5xl w-full mx-auto">
        <h1 className="text-lg font-semibold mb-1">Historial</h1>
        <p className="text-sm text-muted mb-5">Búsqueda y filtrado de conversaciones (no archivadas).</p>

        <HistoryFilters
          filters={filters}
          receptionists={(hotelUsers ?? []).map((u) => ({ id: u.id as string, name: u.display_name as string }))}
        />

        <div className="mt-5 rounded-lg border border-border bg-surface overflow-hidden">
          <ul className="divide-y divide-border">
            {conversations?.length === 0 && (
              <li className="px-4 py-6 text-sm text-muted text-center">
                Sin conversaciones con los filtros actuales.
              </li>
            )}
            {(conversations ?? []).map((c) => {
              const assignedName = c.assigned_to ? (userMap.get(c.assigned_to as string) ?? '—') : '—'
              const duration = c.status === 'resolved'
                ? durationLabel(c.created_at as string, c.updated_at as string)
                : '—'
              return (
                <li key={c.id as string}>
                  <Link
                    href={`/history/${c.id}`}
                    className="block px-4 py-3 hover:bg-surface-alt transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{c.guest_name || 'Guest'}</span>
                          <StatusBadge status={c.status as ConversationStatus} />
                        </div>
                        <div className="mt-1 text-xs text-muted truncate">
                          {new Date(c.created_at as string).toLocaleString('es-ES')}
                        </div>
                      </div>
                      <dl className="text-xs text-muted text-right shrink-0 space-y-0.5">
                        <div><dt className="inline font-medium text-fg">Atendió: </dt><dd className="inline">{assignedName}</dd></div>
                        <div><dt className="inline font-medium text-fg">Duración: </dt><dd className="inline">{duration}</dd></div>
                      </dl>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </main>
    </div>
  )
}
