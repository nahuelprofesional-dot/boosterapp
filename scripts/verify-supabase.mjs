// Programmatic smoke test: login as admin + receptionist, query RLS-scoped
// tables, confirm app sees real data.
//
//   node scripts/verify-supabase.mjs

import fs from 'node:fs'
import path from 'node:path'

const env = Object.fromEntries(
  fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function login(email, password) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`login(${email}) failed: ${JSON.stringify(j)}`)
  return j
}

async function asUser(token, pathname) {
  const r = await fetch(`${URL}${pathname}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  })
  return { status: r.status, body: await r.text() }
}

console.log('=== Admin login ===')
const a = await login('nahuel.profesional@gmail.com', 'admin1234')
console.log('Authenticated:', a.user.email, a.user.id)
console.log('users RLS:', (await asUser(a.access_token, '/rest/v1/users?select=email,display_name,role,hotel_id')).body)
console.log('hotels RLS:', (await asUser(a.access_token, '/rest/v1/hotels?select=id,name')).body)
console.log('conversations RLS (empty expected):', (await asUser(a.access_token, '/rest/v1/conversations?select=id,session_id,status&limit=5')).body)

console.log('\n=== Receptionist login ===')
const r = await login('recepcion@hoteldemo.com', 'recep1234')
console.log('Authenticated:', r.user.email, r.user.id)
console.log('users RLS:', (await asUser(r.access_token, '/rest/v1/users?select=email,display_name,role,hotel_id')).body)
console.log('hotels RLS:', (await asUser(r.access_token, '/rest/v1/hotels?select=id,name')).body)

console.log('\nDone.')
