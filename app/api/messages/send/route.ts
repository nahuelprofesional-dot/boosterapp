import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { broadcastToWidget } from '@/lib/widget-broadcast'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { conversationId?: string; content?: string } | null
  const conversationId = body?.conversationId
  const content = body?.content?.trim()
  if (!conversationId || !content) {
    return NextResponse.json({ error: 'conversationId and content required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, hotel_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'no profile' }, { status: 403 })

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, hotel_id, session_id, status')
    .eq('id', conversationId)
    .single()
  if (!conv) return NextResponse.json({ error: 'conversation not found' }, { status: 404 })
  if (conv.status !== 'human_active') {
    return NextResponse.json({ error: 'conversation is not human_active' }, { status: 409 })
  }

  const createdAt = new Date().toISOString()
  const { error: insErr } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'human',
    sender_name: profile.display_name,
    content,
  })
  if (insErr) {
    return NextResponse.json({ error: 'could not save message' }, { status: 500 })
  }

  // Broadcast to the guest widget. Failure to reach Realtime shouldn't hide
  // the message from the receptionist (it's already in the DB).
  const result = await broadcastToWidget({
    sessionId: conv.session_id,
    content,
    senderName: profile.display_name,
    createdAt,
  }).catch((err) => {
    console.error('widget broadcast failed', err)
    return { ok: false }
  })

  return NextResponse.json({ ok: true, deliveredToWidget: result.ok })
}
