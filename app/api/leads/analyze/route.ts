// Admin-only endpoint that scans recent conversations and uses Claude to
// detect booking-intent guests who never finalised. Results are upserted
// into the `leads` table (unique by conversation_id).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { callClaude, parseJsonBlock, MissingApiKeyError } from '@/lib/anthropic'

export const runtime = 'nodejs'
export const maxDuration = 60

interface AnalysisResult {
  is_lead: boolean
  guest_name?: string | null
  dates_interest?: string | null
  room_type?: string | null
  interest_level?: 'alta' | 'media' | 'baja' | null
  summary?: string | null
}

const SYSTEM_PROMPT = `Eres un analista que clasifica conversaciones de un chatbot de hotel.

Tu tarea: detectar si el huésped mostró INTENCIÓN DE RESERVA pero NO completó la reserva en la conversación.

Indicadores de intención: preguntar precio, disponibilidad, fechas concretas, tipo de habitación, opciones de tarifa, política de cancelación, parking, etc.
Indicadores de "no completó": no hay confirmación de reserva, no se entregó nombre/email para reservar, la conversación se cortó, el huésped dijo "lo pienso", "luego te confirmo", etc.

Devuelve EXACTAMENTE este JSON (sin texto fuera del JSON, sin markdown):
{
  "is_lead": true | false,
  "guest_name": "..." | null,
  "dates_interest": "..." | null,
  "room_type": "..." | null,
  "interest_level": "alta" | "media" | "baja" | null,
  "summary": "una frase en español que diga por qué es un lead"
}

Reglas:
- Si no hay intención de reserva real, is_lead=false y el resto puede ser null.
- guest_name: SOLO si el huésped lo escribió explícitamente.
- dates_interest: las fechas o rango si los mencionó, ej. "10-12 julio".
- room_type: doble, suite, familiar, etc., si lo mencionó.
- interest_level: alta si pidió disponibilidad concreta o precio cerrado; media si preguntó condiciones generales; baja si solo curioseó.
- summary: una sola frase, máximo 140 caracteres.`

async function analyzeConversation(messages: Array<{ sender_type: string; sender_name: string | null; content: string }>): Promise<AnalysisResult | null> {
  if (messages.length === 0) return null
  const transcript = messages.map((m) => {
    const who = m.sender_type === 'guest' ? 'Huésped' : m.sender_type === 'bot' ? 'Bot' : (m.sender_name || 'Recepción')
    return `${who}: ${m.content}`
  }).join('\n')

  const res = await callClaude({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: transcript }],
    max_tokens: 400,
    temperature: 0,
  })

  try {
    return parseJsonBlock<AnalysisResult>(res.text)
  } catch (err) {
    console.error('Failed to parse Claude response:', res.text, err)
    return null
  }
}

// Run promises in batches so we don't slam the API.
async function batched<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    const results = await Promise.all(chunk.map(fn))
    out.push(...results)
  }
  return out
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('hotel_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: conversations, error: convErr } = await admin
    .from('conversations')
    .select('id, status, session_id')
    .eq('hotel_id', profile.hotel_id)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(200)
  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

  if (!conversations?.length) {
    return NextResponse.json({ ok: true, scanned: 0, detected: 0, leads: [] })
  }

  const convIds = conversations.map((c) => c.id)
  const { data: msgs } = await admin
    .from('messages')
    .select('conversation_id, sender_type, sender_name, content, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true })

  const byConv = new Map<string, typeof msgs>()
  for (const m of msgs ?? []) {
    if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, [])
    byConv.get(m.conversation_id)!.push(m)
  }

  try {
    const results = await batched(conversations, 4, async (conv) => {
      const conversationMsgs = byConv.get(conv.id) ?? []
      const r = await analyzeConversation(conversationMsgs.map((m) => ({
        sender_type: m.sender_type as string,
        sender_name: m.sender_name as string | null,
        content: m.content as string,
      })))
      return { conv, analysis: r }
    })

    const toUpsert = results
      .filter((r) => r.analysis?.is_lead && r.analysis.summary)
      .map((r) => ({
        hotel_id: profile.hotel_id,
        conversation_id: r.conv.id,
        guest_name: r.analysis!.guest_name ?? null,
        dates_interest: r.analysis!.dates_interest ?? null,
        room_type: r.analysis!.room_type ?? null,
        interest_level: r.analysis!.interest_level ?? 'baja',
        summary: r.analysis!.summary!,
      }))

    if (toUpsert.length) {
      const { error: upErr } = await admin
        .from('leads')
        .upsert(toUpsert, { onConflict: 'conversation_id' })
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    // Clear leads for conversations now judged non-lead.
    const nonLeadConvIds = results.filter((r) => r.analysis && !r.analysis.is_lead).map((r) => r.conv.id)
    if (nonLeadConvIds.length) {
      await admin.from('leads').delete().in('conversation_id', nonLeadConvIds)
    }

    return NextResponse.json({
      ok: true,
      scanned: conversations.length,
      detected: toUpsert.length,
    })
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({
        error: 'Falta ANTHROPIC_API_KEY en el servidor. Añádela a .env.local y reinicia.',
      }, { status: 503 })
    }
    console.error('analyze error', err)
    const message = err instanceof Error ? err.message : 'analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
