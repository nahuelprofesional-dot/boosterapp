// Admin-only endpoint that permanently deletes every archived conversation
// in the caller's hotel (messages cascade via FK).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function DELETE() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('hotel_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'no profile' }, { status: 403 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Use admin client so we get an accurate count regardless of RLS edge cases.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('conversations')
    .delete()
    .eq('hotel_id', profile.hotel_id)
    .eq('status', 'archived')
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: data?.length ?? 0 })
}
