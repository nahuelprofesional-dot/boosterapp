// Apply a SQL migration to Supabase via the Management API.
//   node scripts/apply-migration.mjs supabase/migrations/0002_hotel_config.sql

import fs from 'node:fs'
import path from 'node:path'

const env = Object.fromEntries(
  fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const PAT = process.env.SUPABASE_PAT || env.SUPABASE_PAT
if (!PAT) throw new Error('Set SUPABASE_PAT in env or .env.local (Personal Access Token sbp_...)')

const file = process.argv[2]
if (!file) throw new Error('usage: node scripts/apply-migration.mjs <path.sql>')

const sql = fs.readFileSync(path.resolve(file), 'utf8')
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0]

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${PAT}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})
const body = await res.text()
console.log('HTTP', res.status, body.slice(0, 2000))
process.exit(res.ok ? 0 : 1)
