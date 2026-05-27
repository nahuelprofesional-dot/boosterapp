import webpush, { type PushSubscription } from 'web-push'

let configured = false

function ensureConfigured() {
  if (configured) return
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL
  if (!pub || !priv || !email) {
    throw new Error('Missing VAPID env vars (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL)')
  }
  webpush.setVapidDetails(`mailto:${email}`, pub, priv)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, unknown>
}

export async function sendPush(subscription: PushSubscription, payload: PushPayload) {
  ensureConfigured()
  return webpush.sendNotification(subscription, JSON.stringify(payload))
}
