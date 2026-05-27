import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { subscription?: unknown } | null
  const subscription = body?.subscription
  if (!subscription || typeof subscription !== 'object') {
    return NextResponse.json({ error: 'subscription required' }, { status: 400 })
  }

  // Upsert by (user_id, endpoint). The endpoint column is generated from the
  // subscription JSON, so the unique constraint catches duplicates per device.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, subscription },
      { onConflict: 'user_id,endpoint' }
    )
  if (error) {
    console.error('push subscribe error', error)
    return NextResponse.json({ error: 'could not save subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
