// One-shot cleanup: delete every conversation + cascaded messages, leaving
// only the seeded hotel + users. Use carefully (it's a TRUNCATE-equivalent
// for conversations).
//   node scripts/clean-test-data.mjs

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log('Before:')
const before = await Promise.all([
  admin.from('conversations').select('id', { count: 'exact', head: true }),
  admin.from('messages').select('id', { count: 'exact', head: true }),
  admin.from('hotels').select('id', { count: 'exact', head: true }),
  admin.from('users').select('id', { count: 'exact', head: true }),
])
console.log('  conversations:', before[0].count, 'messages:', before[1].count, 'hotels:', before[2].count, 'users:', before[3].count)

// Delete all conversations — messages cascade via FK.
// Filter neq impossible-id to satisfy PostgREST's "delete needs a filter" rule.
const { error: dErr, count } = await admin
  .from('conversations')
  .delete({ count: 'exact' })
  .neq('id', '00000000-0000-0000-0000-000000000000')
if (dErr) { console.error('delete failed:', dErr); process.exit(1) }
console.log(`deleted ${count} conversations (+ cascaded messages)`)

console.log('After:')
const after = await Promise.all([
  admin.from('conversations').select('id', { count: 'exact', head: true }),
  admin.from('messages').select('id', { count: 'exact', head: true }),
  admin.from('hotels').select('id', { count: 'exact', head: true }),
  admin.from('users').select('id', { count: 'exact', head: true }),
])
console.log('  conversations:', after[0].count, 'messages:', after[1].count, 'hotels:', after[2].count, 'users:', after[3].count)
