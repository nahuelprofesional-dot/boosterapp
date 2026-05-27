import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendPush } from '@/lib/webpush'
import type { PushSubscription as WebPushSubscription } from 'web-push'

export const runtime = 'nodejs'

interface InboundMessage {
  sessionId?: string
  hotelId?: string
  message?: string
  senderType?: 'guest' | 'bot'
  guestName?: string
  triggerHandoff?: boolean
}

export async function POST(req: NextRequest) {
  // Shared-secret auth so n8n can't be spoofed by random callers.
  const expected = process.env.WEBHOOK_SECRET
  if (expected) {
    const provided = req.headers.get('x-webhook-secret')
    if (provided !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  let body: InboundMessage
  try {
    body = (await req.json()) as InboundMessage
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { sessionId, hotelId, message, senderType, guestName, triggerHandoff } = body
  if (!sessionId || !hotelId || !message || !senderType) {
    return NextResponse.json(
      { error: 'sessionId, hotelId, message, senderType required' },
      { status: 400 }
    )
  }
  if (senderType !== 'guest' && senderType !== 'bot') {
    return NextResponse.json({ error: 'senderType must be guest or bot' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find or create the conversation by (hotel_id, session_id).
  const { data: existing } = await admin
    .from('conversations')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('session_id', sessionId)
    .maybeSingle()

  let conversationId: string
  let conversationStatusBefore: string | null = null

  if (existing) {
    conversationId = existing.id as string
    conversationStatusBefore = existing.status as string
    if (guestName && !existing.guest_name) {
      await admin.from('conversations').update({ guest_name: guestName }).eq('id', conversationId)
    }
  } else {
    const { data: created, error } = await admin
      .from('conversations')
      .insert({
        hotel_id: hotelId,
        session_id: sessionId,
        guest_name: guestName ?? null,
        status: 'bot_active',
      })
      .select('id, status')
      .single()
    if (error || !created) {
      return NextResponse.json({ error: 'could not create conversation' }, { status: 500 })
    }
    conversationId = created.id as string
    conversationStatusBefore = created.status as string
  }

  // Insert the message.
  const { error: msgErr } = await admin.from('messages').insert({
    conversation_id: conversationId,
    sender_type: senderType,
    sender_name: senderType === 'bot' ? 'Bot' : null,
    content: message,
  })
  if (msgErr) {
    return NextResponse.json({ error: 'could not insert message' }, { status: 500 })
  }

  // Handle handoff.
  if (triggerHandoff && conversationStatusBefore !== 'human_active') {
    // Are any receptionists actually online right now? The /chat client pings
    // receptionist_heartbeats every 30 s; we consider a window of 60 s.
    const cutoff = new Date(Date.now() - 60_000).toISOString()
    const { count: liveCount } = await admin
      .from('receptionist_heartbeats')
      .select('user_id', { count: 'exact', head: true })
      .eq('hotel_id', hotelId)
      .gt('last_seen', cutoff)

    const someoneOnline = (liveCount ?? 0) > 0

    if (someoneOnline) {
      // Normal handoff → alert state + push to receptionists.
      await admin
        .from('conversations')
        .update({ status: 'waiting' })
        .eq('id', conversationId)

      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('subscription, user_id, users:users!inner(role, hotel_id, is_active)')
        .eq('users.hotel_id', hotelId)
        .eq('users.is_active', true)

      const guestLabel = guestName || 'un huésped'
      const payload = {
        title: 'Recepción necesaria',
        body: `${guestLabel} necesita atención`,
        data: { conversationId },
      }

      const tasks = (subs ?? []).map(async (row) => {
        try {
          await sendPush(row.subscription as WebPushSubscription, payload)
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode
          if (code === 404 || code === 410) {
            const endpoint = (row.subscription as { endpoint?: string })?.endpoint
            if (endpoint) {
              await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
            }
          } else {
            console.error('push failed', code, err)
          }
        }
      })
      await Promise.allSettled(tasks)
    } else {
      // Nobody on the floor: park the conversation and tell the guest.
      await admin
        .from('conversations')
        .update({ status: 'offline_handoff' })
        .eq('id', conversationId)

      await admin.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'bot',
        sender_name: 'Bot',
        content:
          'En este momento no hay recepcionistas disponibles. Te responderemos en cuanto el equipo esté disponible. También puedes llamarnos al teléfono del hotel.',
      })
    }
  }

  return NextResponse.json({ ok: true, conversationId })
}
