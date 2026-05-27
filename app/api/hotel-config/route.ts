import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { HotelConfig } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('hotel_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'no profile' }, { status: 403 })

  const { data } = await supabase
    .from('hotel_config')
    .select('*')
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  return NextResponse.json({ config: data })
}

interface PutBody extends Partial<Omit<HotelConfig, 'hotel_id' | 'updated_at'>> {}

const ALLOWED: (keyof PutBody)[] = [
  'checkin_time',
  'checkout_time',
  'breakfast_hours',
  'parking_available',
  'parking_price',
  'cancellation_policy',
  'welcome_message',
  'additional_info',
  'bot_name',
  'bot_tone',
  'theme_name',
  'primary_color',
  'accent_color',
]

export async function PUT(req: NextRequest) {
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

  const body = (await req.json().catch(() => null)) as PutBody | null
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const patch: Record<string, unknown> = { hotel_id: profile.hotel_id }
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key] ?? null
  }
  if (typeof patch.parking_available !== 'boolean') {
    patch.parking_available = patch.parking_available === true
  }

  const { data, error } = await supabase
    .from('hotel_config')
    .upsert(patch, { onConflict: 'hotel_id' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
