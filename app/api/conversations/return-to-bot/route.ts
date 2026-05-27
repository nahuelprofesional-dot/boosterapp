import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const SYSTEM_MESSAGE = 'Recepción ha devuelto la conversación al asistente'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { conversationId?: string } | null
  const conversationId = body?.conversationId
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  }

  // Only flip if currently human_active. RLS already scopes by hotel.
  const { data: updated, error: updErr } = await supabase
    .from('conversations')
    .update({ status: 'bot_active', assigned_to: null })
    .eq('id', conversationId)
    .eq('status', 'human_active')
    .select('id, status')
    .single()

  if (updErr) {
    return NextResponse.json({ error: 'could not return to bot' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'conversation is not human_active' }, { status: 409 })
  }

  // Drop a marker message into the thread so the receptionist log shows the
  // handback. Stored as a bot message named "Sistema" — keeps the existing
  // sender_type enum unchanged.
  const { error: insErr } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'bot',
    sender_name: 'Sistema',
    content: SYSTEM_MESSAGE,
  })
  if (insErr) {
    console.error('return-to-bot system message insert failed', insErr)
  }

  return NextResponse.json({ ok: true })
}
