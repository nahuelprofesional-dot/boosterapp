import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 }

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('hotel_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('leads')
    .select('id, conversation_id, guest_name, dates_interest, room_type, interest_level, summary, created_at, updated_at')
    .eq('hotel_id', profile.hotel_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = (data ?? []).slice().sort((a, b) => {
    const oa = ORDER[a.interest_level as string] ?? 9
    const ob = ORDER[b.interest_level as string] ?? 9
    if (oa !== ob) return oa - ob
    return new Date(b.updated_at as string).getTime() - new Date(a.updated_at as string).getTime()
  })

  return NextResponse.json({ leads: sorted })
}
