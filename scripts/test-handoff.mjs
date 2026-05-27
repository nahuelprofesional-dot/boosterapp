// Simulates two messages from n8n hitting BoosterApp's webhook:
//   1) Guest asks about a reservation (bot still active)
//   2) Bot escalates to human (triggers handoff → status 'waiting', red alert)
//
// Run:  node scripts/test-handoff.mjs
// Env overrides (optional):
//   APP_URL=https://your-host.com   (default http://localhost:3000)
//   HOTEL_ID=<uuid>                 (default: hotel-demo from credentials)

import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const APP_URL  = process.env.APP_URL  || 'http://localhost:3000'
const HOTEL_ID = process.env.HOTEL_ID || '801f4f23-526f-46b9-aa40-01a4d1f4535a'
const SECRET   = env.WEBHOOK_SECRET
if (!SECRET) {
  console.error('Missing WEBHOOK_SECRET in .env.local'); process.exit(2)
}

const SESSION_ID = 'test_live_001'

async function post(label, payload) {
  const res = await fetch(`${APP_URL}/api/webhook/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': SECRET,
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  console.log(`[${label}] HTTP ${res.status}`, body)
  if (!res.ok) process.exit(1)
  return body
}

console.log(`POSTing to ${APP_URL}/api/webhook/message`)
console.log(`session=${SESSION_ID}  hotel=${HOTEL_ID}\n`)

await post('1/2 guest message', {
  sessionId: SESSION_ID,
  hotelId: HOTEL_ID,
  message: 'Hola, quiero reservar una habitación para este fin de semana',
  senderType: 'guest',
  guestName: 'Carlos M.',
  triggerHandoff: false,
})

console.log('\nEsperando 3 s antes del handoff...\n')
await new Promise((r) => setTimeout(r, 3000))

await post('2/2 bot handoff', {
  sessionId: SESSION_ID,
  hotelId: HOTEL_ID,
  message: 'Para esto es mejor que te atienda nuestro equipo. Te paso ahora mismo.',
  senderType: 'bot',
  triggerHandoff: true,
})

console.log('\nListo. Abre BoosterApp /chat — la conversación de "Carlos M." debería aparecer con la alerta roja.')
