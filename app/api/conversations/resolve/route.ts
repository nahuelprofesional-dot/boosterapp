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

  const { data, error } = await supabase
    .from('conversations')
    .update({ status: 'resolved' })
    .eq('id', conversationId)
    .select('id, status')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'could not resolve' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
