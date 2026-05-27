import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import type { UserRole } from '@/lib/types'

export const runtime = 'nodejs'

interface PatchBody {
  display_name?: string
  role?: UserRole
}

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const { data: caller } = await supabase
    .from('users')
    .select('hotel_id, role')
    .eq('id', user.id)
    .single()
  if (!caller || caller.role !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }
  return { caller, callerId: user.id }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = (await req.json().catch(() => null)) as PatchBody | null
  const updates: Record<string, unknown> = {}
  if (typeof body?.display_name === 'string' && body.display_name.trim()) {
    updates.display_name = body.display_name.trim()
  }
  if (body?.role === 'admin' || body?.role === 'receptionist') {
    updates.role = body.role
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  // Hotel scope check — admin can only edit users in their own hotel.
  const { data: target } = await admin
    .from('users')
    .select('id, hotel_id')
    .eq('id', params.id)
    .single()
  if (!target || target.hotel_id !== auth.caller.hotel_id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('users')
    .update(updates)
    .eq('id', params.id)
    .select('id, display_name, role, email, hotel_id, is_active')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, user: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  if (params.id === auth.callerId) {
    return NextResponse.json({ error: "can't delete yourself" }, { status: 400 })
  }

  const admin = createAdminClient()
  // Hotel scope check.
  const { data: target } = await admin
    .from('users')
    .select('id, hotel_id')
    .eq('id', params.id)
    .single()
  if (!target || target.hotel_id !== auth.caller.hotel_id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Deleting the auth user cascades to public.users (FK on delete cascade).
  const { error } = await admin.auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
