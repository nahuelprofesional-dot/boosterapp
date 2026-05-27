// Admin-only endpoint that summarises the last 7 days of conversations for
// the caller's hotel. We pre-compute deterministic metrics (bot %, busiest
// hours, totals) so the numbers are exact, then ask the model to add
// qualitative analysis (FAQ themes, issues, recommendation) in Spanish.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { callOpenAI, MissingApiKeyError } from '@/lib/openai'

export const runtime = 'nodejs'
export const maxDuration = 60

interface Metrics {
  totalConversations: number
  resolvedByBotPct: number | null
  requiredHumanPct: number | null
  busiestHours: Array<{ hour: number; count: number }>
  totalMessages: number
}

const SYSTEM_PROMPT = `Eres un asistente que analiza la actividad semanal de un chatbot de hotel.

Te paso (a) métricas calculadas y (b) una muestra de mensajes de huéspedes. Tu tarea: devolver un resumen breve en español, con tono profesional y constructivo, en formato Markdown, con esta estructura EXACTA:

## Preguntas más frecuentes
- (3-5 viñetas describiendo los temas más recurrentes que preguntaron los huéspedes)

## Rendimiento del bot
- (1-2 viñetas comentando el % resueltas sin humano y qué significa)

## Horas con más actividad
- (1-2 viñetas, citando las horas con más conversaciones)

## Incidencias o quejas recurrentes
- (1-3 viñetas, solo si las detectas; si no hay, escribe "Sin incidencias relevantes esta semana.")

## Recomendación
- (UNA recomendación concreta y accionable para el hotel basada en los datos)

No inventes datos. Si no hay información suficiente, dilo. Máximo ~300 palabras.`

function topHours(buckets: number[]): Array<{ hour: number; count: number }> {
  return buckets
    .map((count, hour) => ({ hour, count }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
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
  const sinceISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: convs } = await admin
    .from('conversations')
    .select('id, status, created_at')
    .eq('hotel_id', profile.hotel_id)
    .gte('created_at', sinceISO)
  const convList = convs ?? []

  if (convList.length === 0) {
    return NextResponse.json({
      ok: true,
      metrics: { totalConversations: 0, resolvedByBotPct: null, requiredHumanPct: null, busiestHours: [], totalMessages: 0 } satisfies Metrics,
      summary: 'No hay actividad registrada en los últimos 7 días.',
    })
  }

  const convIds = convList.map((c) => c.id as string)
  const [{ data: humanMsgs }, { data: guestMsgs }] = await Promise.all([
    admin.from('messages').select('conversation_id').eq('sender_type', 'human').in('conversation_id', convIds),
    admin.from('messages').select('content, created_at').eq('sender_type', 'guest').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(200),
  ])

  const humanConvIds = new Set((humanMsgs ?? []).map((m) => m.conversation_id as string))
  const resolved = convList.filter((c) => c.status === 'resolved')
  const resolvedByBot = resolved.filter((c) => !humanConvIds.has(c.id as string)).length
  const requiredHuman = convList.filter((c) => humanConvIds.has(c.id as string)).length

  const buckets = Array(24).fill(0) as number[]
  for (const c of convList) {
    const h = new Date(c.created_at as string).getHours()
    buckets[h] = (buckets[h] || 0) + 1
  }

  const total = convList.length
  const metrics: Metrics = {
    totalConversations: total,
    resolvedByBotPct: total > 0 ? Math.round((resolvedByBot / total) * 100) : null,
    requiredHumanPct: total > 0 ? Math.round((requiredHuman / total) * 100) : null,
    busiestHours: topHours(buckets),
    totalMessages: guestMsgs?.length ?? 0,
  }

  // Build the user message: metrics block + sampled guest texts.
  const sampledLines = (guestMsgs ?? [])
    .slice(0, 120)
    .map((m) => `- ${(m.content as string).replace(/\s+/g, ' ').slice(0, 200)}`)
    .join('\n')

  const userPrompt = [
    '## Métricas (deterministas, no las recalcules)',
    `- Conversaciones totales: ${metrics.totalConversations}`,
    `- Resueltas sin intervención humana: ${metrics.resolvedByBotPct == null ? '—' : metrics.resolvedByBotPct + '%'} (${resolvedByBot} de ${total})`,
    `- Requirieron recepción: ${metrics.requiredHumanPct == null ? '—' : metrics.requiredHumanPct + '%'} (${requiredHuman} de ${total})`,
    `- Horas con más actividad: ${metrics.busiestHours.length === 0 ? '—' : metrics.busiestHours.map((b) => `${b.hour}:00 (${b.count})`).join(', ')}`,
    '',
    '## Mensajes de huéspedes (muestra)',
    sampledLines || '(sin mensajes)',
  ].join('\n')

  try {
    const res = await callOpenAI({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 900,
      temperature: 0.3,
    })
    return NextResponse.json({ ok: true, metrics, summary: res.text.trim() })
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({
        error: 'Falta OPENAI_API_KEY en el servidor. Añádela a .env.local y reinicia.',
      }, { status: 503 })
    }
    console.error('weekly-summary error', err)
    const message = err instanceof Error ? err.message : 'summary failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
