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

// Send a push to every active receptionist/admin at the hotel, OR only the
// assigned receptionist if userIdFilter is provided. Returns silently on
// failure — push delivery shouldn't block the webhook response.
async function pushToHotel(opts: {
  admin: ReturnType<typeof createAdminClient>
  hotelId: string
  userIdFilter?: string
  payload: { title: string; body: string; data?: Record<string, unknown> }
}) {
  let query = opts.admin
    .from('push_subscriptions')
    .select('subscription, endpoint, user_id, users:users!inner(role, hotel_id, is_active)')
    .eq('users.hotel_id', opts.hotelId)
    .eq('users.is_active', true)
  if (opts.userIdFilter) query = query.eq('user_id', opts.userIdFilter)

  const { data: subs } = await query
  await Promise.allSettled(
    (subs ?? []).map(async (row) => {
      try {
        await sendPush(row.subscription as WebPushSubscription, opts.payload)
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {
          const endpoint = (row.subscription as { endpoint?: string })?.endpoint
          if (endpoint) {
            await opts.admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
          }
        } else {
          console.error('push failed', code, err)
        }
      }
    })
  )
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
  let assignedTo: string | null = null

  if (existing) {
    conversationId = existing.id as string
    conversationStatusBefore = existing.status as string
    assignedTo = (existing.assigned_to as string | null) ?? null
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
      .select('id, status, assigned_to')
      .single()
    if (error || !created) {
      return NextResponse.json({ error: 'could not create conversation' }, { status: 500 })
    }
    conversationId = created.id as string
    conversationStatusBefore = created.status as string
    assignedTo = (created.assigned_to as string | null) ?? null
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

  // Guest messages while a human is in control: don't run the bot, but ping
  // the receptionist who took the conversation so they know there's new traffic.
  // The /chat UI already updates live via Realtime, so this is just a nudge.
  if (
    senderType === 'guest' &&
    conversationStatusBefore === 'human_active'
  ) {
    const guestLabel = guestName || 'Huésped'
    await pushToHotel({
      admin,
      hotelId,
      userIdFilter: assignedTo ?? undefined,
      payload: {
        title: `Mensaje de ${guestLabel}`,
        body: message.slice(0, 140),
        data: { conversationId },
      },
    })
  }

  // Handle handoff. Only meaningful if we're still in bot land.
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
      await admin
        .from('conversations')
        .update({ status: 'waiting' })
        .eq('id', conversationId)

      const guestLabel = guestName || 'un huésped'
      await pushToHotel({
        admin,
        hotelId,
        payload: {
          title: 'Recepción necesaria',
          body: `${guestLabel} necesita atención`,
          data: { conversationId },
        },
      })
    } else {
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

  // Tell n8n whether it should run the AI Agent for this turn. The workflow
  // has an IF node right after this call that gates the agent on this flag.
  // The bot should only reply when (a) this is a guest message and (b) the
  // conversation is in a bot-driven state. If the handoff just fired above,
  // we're now in 'waiting' or 'offline_handoff' and the bot must stay quiet.
  const handoffJustFired = !!triggerHandoff && conversationStatusBefore !== 'human_active'
  const botShouldReply =
    senderType === 'guest' &&
    !handoffJustFired &&
    conversationStatusBefore !== 'human_active' &&
    conversationStatusBefore !== 'resolved' &&
    conversationStatusBefore !== 'archived'

  return NextResponse.json({
    ok: true,
    conversationId,
    botShouldReply,
  })
}
