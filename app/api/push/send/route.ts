import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendPush } from '@/lib/webpush'
import type { PushSubscription as WebPushSubscription } from 'web-push'

export const runtime = 'nodejs'

// Internal endpoint to fan out a custom push to a hotel's receptionists.
// Same shared secret as the n8n webhook.
export async function POST(req: NextRequest) {
  const expected = process.env.WEBHOOK_SECRET
  if (expected) {
    const provided = req.headers.get('x-webhook-secret')
    if (provided !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => null) as
    | { hotelId?: string; title?: string; body?: string; conversationId?: string }
    | null
  const hotelId = body?.hotelId
  const title = body?.title
  const text = body?.body
  const conversationId = body?.conversationId
  if (!hotelId || !title || !text) {
    return NextResponse.json({ error: 'hotelId, title, body required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('subscription, users:users!inner(role, hotel_id, is_active)')
    .eq('users.hotel_id', hotelId)
    .eq('users.is_active', true)

  const payload = { title, body: text, data: conversationId ? { conversationId } : {} }

  const results = await Promise.allSettled(
    (subs ?? []).map(async (row) => {
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
          throw err
        }
      }
    })
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ ok: true, attempted: subs?.length ?? 0, sent })
}
