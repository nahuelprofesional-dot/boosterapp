// Outbound delivery to the guest-facing chat widget via Supabase Realtime broadcast.
// The widget subscribes to channel `widget:{sessionId}` with the anon key and
// receives every receptionist message in real time. No webhook, no third party.
//
// Server posts to /realtime/v1/api/broadcast with the service-role key, which
// bypasses any channel auth. Payload is JSON:
//   { messages: [{ topic, event: 'message', payload: {...} }] }

export interface WidgetBroadcastPayload {
  sessionId: string
  content: string
  senderName: string
  createdAt: string
}

export async function broadcastToWidget(msg: WidgetBroadcastPayload) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('Supabase env missing; widget broadcast skipped')
    return { ok: false, skipped: true as const }
  }

  const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `widget:${msg.sessionId}`,
          event: 'message',
          payload: {
            content: msg.content,
            senderName: msg.senderName,
            senderType: 'human',
            createdAt: msg.createdAt,
          },
          private: false,
        },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('Realtime broadcast failed', res.status, text)
  }
  return { ok: res.ok, status: res.status }
}
