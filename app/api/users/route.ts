import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import type { UserRole } from '@/lib/types'

export const runtime = 'nodejs'

interface CreateBody {
  email?: string
  password?: string
  display_name?: string
  role?: UserRole
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: caller } = await supabase
    .from('users')
    .select('hotel_id, role')
    .eq('id', user.id)
    .single()
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password ?? ''
  const displayName = body?.display_name?.trim()
  const role: UserRole = body?.role === 'admin' ? 'admin' : 'receptionist'
  if (!email || !password || !displayName) {
    return NextResponse.json({ error: 'email, password and display_name required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    const status = createErr?.status ?? 500
    return NextResponse.json({ error: createErr?.message ?? 'could not create auth user' }, { status })
  }

  const { error: profileErr } = await admin.from('users').insert({
    id: created.user.id,
    hotel_id: caller.hotel_id,
    email,
    display_name: displayName,
    role,
  })
  if (profileErr) {
    // Roll back the auth user so we don't leave an orphan.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
    return NextResponse.json({ error: 'could not create profile: ' + profileErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: created.user.id,
      email,
      display_name: displayName,
      role,
      hotel_id: caller.hotel_id,
      is_active: true,
    },
  })
}
