import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AppHeader from '@/components/AppHeader'
import LeadsClient from './LeadsClient'
import type { Lead } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 }

export default async function LeadsPage() {
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

  const [{ data: hotel }, { data: leadsRaw }] = await Promise.all([
    supabase.from('hotels').select('id, name').eq('id', profile.hotel_id).single(),
    supabase
      .from('leads')
      .select('id, conversation_id, guest_name, dates_interest, room_type, interest_level, summary, created_at, updated_at')
      .eq('hotel_id', profile.hotel_id),
  ])

  const initialLeads: Lead[] = (leadsRaw ?? []).slice().sort((a, b) => {
    const oa = ORDER[a.interest_level as string] ?? 9
    const ob = ORDER[b.interest_level as string] ?? 9
    if (oa !== ob) return oa - ob
    return new Date(b.updated_at as string).getTime() - new Date(a.updated_at as string).getTime()
  }) as Lead[]

  return (
    <div className="flex flex-col h-dvh">
      <AppHeader
        title="BoosterApp"
        role={profile.role}
        displayName={profile.display_name}
        hotelName={hotel?.name}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-5xl w-full mx-auto">
        <LeadsClient initialLeads={initialLeads} />
      </main>
    </div>
  )
}
