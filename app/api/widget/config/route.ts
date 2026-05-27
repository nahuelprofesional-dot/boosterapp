// Public read-only endpoint for the guest-facing chat widget.
// Returns only the appearance fields (bot name, tone, welcome message, theme,
// primary/accent colors) — never any private content. No secret required, and
// CORS is wide open so it can be called from any hotel's website.
//
//   GET /api/widget/config?hotelId=<uuid>
//   GET /api/widget/config?sessionId=<text>

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
} as const

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const hotelId = url.searchParams.get('hotelId')
  const sessionId = url.searchParams.get('sessionId')
  if (!hotelId && !sessionId) {
    return NextResponse.json(
      { error: 'hotelId or sessionId required' },
      { status: 400, headers: CORS_HEADERS },
    )
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
    if (!conv) {
      return NextResponse.json(
        { error: 'session not found' },
        { status: 404, headers: CORS_HEADERS },
      )
    }
    resolvedHotelId = conv.hotel_id
  }

  const { data: config } = await admin
    .from('hotel_config')
    .select('bot_name, bot_tone, welcome_message, theme_name, primary_color, accent_color')
    .eq('hotel_id', resolvedHotelId!)
    .maybeSingle()

  return NextResponse.json(
    {
      hotelId: resolvedHotelId,
      config: config ?? null,
    },
    { headers: CORS_HEADERS },
  )
}
