// Read-only endpoint for the n8n workflow to fetch a hotel's bot content.
// Auth: x-webhook-secret header must match WEBHOOK_SECRET.
//
//   GET /api/webhook/hotel-config?hotelId=<uuid>
//   GET /api/webhook/hotel-config?sessionId=<text>   (resolves to its hotel)

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const hotelId = url.searchParams.get('hotelId')
  const sessionId = url.searchParams.get('sessionId')
  if (!hotelId && !sessionId) {
    return NextResponse.json({ error: 'hotelId or sessionId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  let resolvedHotelId = hotelId
  if (!resolvedHotelId && sessionId) {
    const { data: conv } = await admin
      .from('conversations')
      .select('hotel_id')
      .eq('session_id', sessionId)
      .limit(1)
      .maybeSingle()
    if (!conv) return NextResponse.json({ error: 'session not found' }, { status: 404 })
    resolvedHotelId = conv.hotel_id
  }

  const { data: config } = await admin
    .from('hotel_config')
    .select('*')
    .eq('hotel_id', resolvedHotelId!)
    .maybeSingle()

  return NextResponse.json({ hotelId: resolvedHotelId, config: config ?? null })
}
