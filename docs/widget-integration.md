# Widget integration — receive staff replies via Supabase Realtime

The guest-facing chat widget no longer goes through n8n for receptionist
replies. Instead, BoosterApp broadcasts each staff message on a Supabase
Realtime channel that is keyed by the widget's own session id. The widget
just subscribes with the public anon key and renders incoming messages.

## What the widget needs to do

```html
<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

  const SUPABASE_URL  = 'https://bscoqtzeyupbdxvbwcto.supabase.co'
  const SUPABASE_ANON = '<NEXT_PUBLIC_SUPABASE_ANON_KEY>'

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

  // sessionId is whatever the widget already uses to identify this guest
  // chat (the same value n8n knows about). Keep it stable for the lifetime
  // of the conversation.
  const sessionId = getOrCreateSessionId()

  const channel = supabase.channel(`widget:${sessionId}`)
  channel
    .on('broadcast', { event: 'message' }, ({ payload }) => {
      // payload = { content, senderName, senderType: 'human', createdAt }
      renderStaffMessage(payload)
    })
    .subscribe()
</script>
```

## Payload shape

```json
{
  "content":    "Texto que escribió la recepción",
  "senderName": "Jorge",
  "senderType": "human",
  "createdAt":  "2026-05-23T20:41:55.034Z"
}
```

Only `senderType: "human"` messages flow through this channel — bot replies
still come from the existing n8n workflow.

## Why this works

- BoosterApp's `/api/messages/send` route inserts the receptionist message
  into Supabase and POSTs to `/realtime/v1/api/broadcast` with the
  service-role key.
- The widget is anonymous (anon key only) and subscribes to a public topic
  named after its `sessionId`. No RLS dance required.
- The topic name is the only secret. Keep `sessionId` random enough that an
  attacker can't guess another guest's id (a UUID v4 is fine).

## Removing the old n8n outbound

The widget previously listened for a webhook callback from n8n to receive
staff messages. That path is no longer needed and can be deleted from the
n8n workflow. The widget → n8n → bot path (incoming guest messages) is
unchanged.
