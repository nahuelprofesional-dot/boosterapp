// One-shot seed: creates "Hotel Demo", an admin auth user, and a receptionist
// auth user, then links them via public.users. Uses the service-role key — never
// run from the browser.
//
//   node scripts/seed-supabase.mjs
//
// Idempotent: re-running reuses existing hotel/users by email/name.

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.join(process.cwd(), '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) throw new Error('Missing SUPABASE env vars')

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

async function rest(pathname, init = {}) {
  const res = await fetch(`${URL}${pathname}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  })
  const text = await res.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${pathname} → ${res.status}: ${text}`)
  }
  return body
}

async function getOrCreateHotel(name) {
  const existing = await rest(`/rest/v1/hotels?name=eq.${encodeURIComponent(name)}&select=id,name`)
  if (existing.length) {
    console.log(`✓ Hotel already exists: ${existing[0].id}`)
    return existing[0].id
  }
  const created = await rest('/rest/v1/hotels', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name }),
  })
  console.log(`✓ Hotel created: ${created[0].id}`)
  return created[0].id
}

async function getOrCreateAuthUser(email, password) {
  // List existing users (Admin Auth API). Filter client-side; the `email=` query
  // param is supported on most projects but pagination may be needed at scale.
  const list = await rest(`/auth/v1/admin/users?per_page=200`)
  const found = (list.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (found) {
    console.log(`✓ Auth user already exists: ${email} (${found.id})`)
    return found.id
  }
  const created = await rest('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  console.log(`✓ Auth user created: ${email} (${created.id})`)
  return created.id
}

async function upsertProfile({ id, hotel_id, display_name, email, role }) {
  // Upsert on primary key. Prefer header tells PostgREST to merge.
  await rest('/rest/v1/users', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, hotel_id, display_name, email, role }),
  })
  console.log(`✓ Profile upserted: ${email} (${role})`)
}

const hotelId = await getOrCreateHotel('Hotel Demo')

const adminId = await getOrCreateAuthUser('nahuel.profesional@gmail.com', 'admin1234')
await upsertProfile({
  id: adminId,
  hotel_id: hotelId,
  display_name: 'Admin',
  email: 'nahuel.profesional@gmail.com',
  role: 'admin',
})

const recepId = await getOrCreateAuthUser('recepcion@hoteldemo.com', 'recep1234')
await upsertProfile({
  id: recepId,
  hotel_id: hotelId,
  display_name: 'Jorge',
  email: 'recepcion@hoteldemo.com',
  role: 'receptionist',
})

console.log('\nDone.')
console.log({ hotelId, adminId, recepId })
