# BoosterApp

Hotel chatbot management panel for BoosterLab Studio. PWA built on Next.js 14
(App Router) + Tailwind + Supabase, with Web Push notifications and Supabase
Realtime for the live chat.

Two roles share one login:

- **admin** → `/dashboard` (metrics) and `/chat`
- **receptionist** → `/chat` only

Each hotel is an isolated workspace. Row Level Security in Supabase scopes
every read/write to the caller's `hotel_id`.

---

## 1. Install

```bash
npm install
```

Drop your app icons into `public/icons/`:

- `icon-192.png` — 192×192
- `icon-512.png` — 512×512

(see `public/icons/README.md`).

## 2. Create the Supabase project

1. Go to https://supabase.com → new project. Region: closest to your hotels.
2. From **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose)

3. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`,
   run it. This creates all tables, enums, triggers, the realtime publication,
   and RLS policies.

## 3. Generate VAPID keys (Web Push)

```bash
npm run vapid
```

Copy the three lines into `.env.local`.

## 4. Configure env

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
N8N_WEBHOOK_URL=https://<your-n8n>/webhook/booster-outbound
WEBHOOK_SECRET=<random string — n8n must send this in x-webhook-secret>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=hola@boosterlab.studio
```

## 5. Seed the first hotel + admin user

Supabase Auth owns credentials. The flow is:

1. In Supabase Studio → **Authentication → Users**, click **Add user**.
   Pick an email + password for the first admin. Note the resulting UUID.
2. Open `supabase/seed.sql` and replace the placeholder UUID with that user's id.
3. Paste the file into the SQL Editor and run it. This creates the hotel row and
   the matching `public.users` profile (with role `admin`).

To add a receptionist later: create the auth user in Studio, then run the
`insert into public.users (...) values (...)` snippet at the bottom of
`seed.sql` with that user's id and `role = 'receptionist'`.

## 6. Run locally

```bash
npm run dev
```

Visit http://localhost:3000 → you'll bounce to `/login`. Sign in with the admin
you created. Admin lands on `/dashboard`; receptionists land on `/chat`.

## 7. Wire up n8n

### Inbound (n8n → BoosterApp)

When your n8n flow processes a guest or bot message, POST to:

```
POST  https://<your-app>/api/webhook/message
Headers:
  content-type: application/json
  x-webhook-secret: <WEBHOOK_SECRET>

Body:
{
  "sessionId":      "<sessionId from the widget>",
  "hotelId":        "<uuid of the hotel>",
  "message":        "Hello, is breakfast included?",
  "senderType":     "guest",           // or "bot"
  "guestName":      "Marta",           // optional
  "triggerHandoff": false              // true when bot decides to escalate
}
```

When `triggerHandoff: true`:

- Conversation status → `waiting`
- Push notifications fan out to every receptionist in the hotel that has a
  push subscription on file

### Outbound (BoosterApp → n8n)

When a receptionist sends a reply from `/chat`, BoosterApp POSTs to
`N8N_WEBHOOK_URL`:

```
POST  N8N_WEBHOOK_URL
{
  "sessionId":  "<sessionId>",
  "message":    "<receptionist text>",
  "senderType": "human",
  "hotelId":    "<uuid>"
}
```

Your n8n flow is responsible for routing that text back into the widget for the
right guest session.

## 8. Deploy to Vercel

```bash
npx vercel
```

In the Vercel dashboard, add every variable from `.env.local`. Re-deploy.

In Supabase → **Authentication → URL Configuration**, set the Site URL to your
Vercel domain.

---

## File tree (what's where)

```
app/
  login/              Email + password sign-in (Supabase Auth)
  chat/               Live chat — the MVP core
  dashboard/          Admin metrics
  api/
    webhook/message/  Inbound from n8n (service-role, bypasses RLS)
    messages/send/    Receptionist reply → DB + outbound to n8n
    conversations/
      take/           Takeover (status → human_active)
      resolve/        Resolve (status → resolved)
    push/
      subscribe/      Save PushManager subscription to Supabase
      send/           Internal fan-out (called by webhook/message on handoff)
components/
  chat/               Conversation list, thread, bubbles, takeover banner, input
  dashboard/          Metric cards + 24-bar hourly chart
  shared/             StatusBadge, UserAvatar
  AppHeader, LogoutButton
lib/
  supabase-browser.ts / supabase-server.ts / supabase-admin.ts
  webpush.ts          VAPID + send wrapper
  n8n.ts              Outbound HTTP
  types.ts
public/
  manifest.json       PWA manifest
  sw.js               Service worker (push + notification click)
  icons/              Drop icon-192.png and icon-512.png here
supabase/
  migrations/0001_init.sql
  seed.sql
middleware.ts         Auth gating
```

## What this MVP intentionally does NOT include

WhatsApp/Instagram, content editor, CRM, themes, archive, AI summaries,
performance ratings, dark mode, exports, BoosterLab internal admin. See the
spec — these are explicitly out of scope.

## Testing the realtime + push loop locally

1. Two browser windows, one signed in as admin, one as receptionist (or the
   same user in two tabs).
2. From a terminal, simulate a handoff:

   ```bash
   curl -X POST http://localhost:3000/api/webhook/message \
     -H "content-type: application/json" \
     -H "x-webhook-secret: $WEBHOOK_SECRET" \
     -d '{
       "sessionId":      "test-session-1",
       "hotelId":        "<your hotel uuid>",
       "message":        "Hola, tengo una pregunta urgente",
       "senderType":     "guest",
       "guestName":      "Marta",
       "triggerHandoff": true
     }'
   ```

3. Both windows should see the new conversation appear with the red **Alerta**
   badge in real time, and (if push permission was granted) a system
   notification.
4. Click **Tomar el mando**. The badge flips to **Humano** in both windows;
   only the taking window's input becomes active.
5. Send a reply. Watch your n8n flow receive the outbound POST.
6. Click **Marcar como resuelto**. Badge flips to **Resuelto**, thread becomes
   read-only.
