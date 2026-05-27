// Receptionist liveness heartbeat. The browser pings every ~30 s while the
// /chat tab is open. The webhook reads this table to decide whether a handoff
// can flip a conversation to 'waiting' (someone is around) or has to fall back
// to 'offline_handoff' (no one to take it).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('hotel_id, role, is_active')
    .eq('id', user.id)
    .single()
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'no profile' }, { status: 403 })
  }

  const { error } = await supabase
    .from('receptionist_heartbeats')
    .upsert(
      { user_id: user.id, hotel_id: profile.hotel_id, last_seen: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
