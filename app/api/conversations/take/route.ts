import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { conversationId?: string } | null
  const conversationId = body?.conversationId
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  }

  // RLS restricts the update to the caller's hotel; no extra check needed.
  const { data, error } = await supabase
    .from('conversations')
    .update({ status: 'human_active', assigned_to: user.id })
    .eq('id', conversationId)
    .in('status', ['waiting', 'offline_handoff', 'bot_active'])
    .select('id, status, assigned_to')
    .single()

  if (error) {
    return NextResponse.json({ error: 'could not take conversation' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'conversation not in a takeable state' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, conversation: data })
}
