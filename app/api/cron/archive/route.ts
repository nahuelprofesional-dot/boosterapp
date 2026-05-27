// Scheduled job that moves resolved conversations older than 7 days into
// 'archived'. Designed to be called by Vercel Cron (or any external scheduler)
// with `x-webhook-secret: $WEBHOOK_SECRET`.
//
//   POST /api/cron/archive
//
// Returns { ok, archived } where `archived` is the number of rows updated.

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Accepts two flavours of auth so the same endpoint works for both runtimes:
  //   • Vercel Cron       → Authorization: Bearer $CRON_SECRET
  //   • n8n / manual call → x-webhook-secret: $WEBHOOK_SECRET
  // If neither env var is set, the endpoint is open (NOT recommended in prod).
  const cronSecret    = process.env.CRON_SECRET
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (cronSecret || webhookSecret) {
    const fromHeader = req.headers.get('x-webhook-secret')
    const fromBearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const okCron    = !!cronSecret    && fromBearer === cronSecret
    const okWebhook = !!webhookSecret && (fromHeader === webhookSecret || fromBearer === webhookSecret)
    if (!okCron && !okWebhook) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('conversations')
    .update({ status: 'archived' })
    .eq('status', 'resolved')
    .lt('updated_at', cutoff)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, archived: data?.length ?? 0, cutoff })
}

// Allow GET too so a cron service that only does GET still works.
export async function GET(req: NextRequest) {
  return POST(req)
}
