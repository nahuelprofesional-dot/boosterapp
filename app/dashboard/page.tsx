import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AppHeader from '@/components/AppHeader'
import MetricCard from '@/components/dashboard/MetricCard'
import HourlyChart from '@/components/dashboard/HourlyChart'
import WeeklySummary from '@/components/dashboard/WeeklySummary'
import ComparisonSection, { type WeekStats } from '@/components/dashboard/ComparisonSection'

export const dynamic = 'force-dynamic'

function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfWeekISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  return d.toISOString()
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  return `${Math.round((numerator / denominator) * 100)}%`
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, hotel_id, display_name, email, role, is_active')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/chat')

  const { data: hotel } = await supabase
    .from('hotels')
    .select('id, name')
    .eq('id', profile.hotel_id)
    .single()

  const todayISO = startOfTodayISO()
  const weekISO = startOfWeekISO()

  // Conversations today (this hotel — RLS already scopes it)
  const todayQ = supabase
    .from('conversations')
    .select('id, status, created_at, updated_at', { count: 'exact' })
    .gte('created_at', todayISO)

  const weekQ = supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', weekISO)

  const [{ data: todayConvs, count: totalToday }, { count: totalWeek }] =
    await Promise.all([todayQ, weekQ])

  const todayIds = (todayConvs ?? []).map((c) => c.id as string)

  // For today's conversations: detect whether each one had any human message.
  // We do it in one shot: select distinct conversation_id from messages where
  // sender_type='human' and conversation_id in (today's ids).
  let humanConvIds = new Set<string>()
  if (todayIds.length) {
    const { data: humanMsgs } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('sender_type', 'human')
      .in('conversation_id', todayIds)
    for (const row of humanMsgs ?? []) humanConvIds.add(row.conversation_id as string)
  }

  const resolvedToday = (todayConvs ?? []).filter((c) => c.status === 'resolved')
  const resolvedByBot = resolvedToday.filter((c) => !humanConvIds.has(c.id as string)).length
  const requiredHuman = (todayConvs ?? []).filter((c) => humanConvIds.has(c.id as string)).length

  // Average alert→takeover time. Approximation for the MVP:
  // alert = the moment the conversation entered 'waiting' (we don't log that
  // explicitly, so we use the timestamp of the last guest/bot message before
  // the first human message). takeover = first human message timestamp.
  let avgTakeoverMin: number | null = null
  if (todayIds.length) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, sender_type, created_at')
      .in('conversation_id', todayIds)
      .order('created_at', { ascending: true })

    const byConv = new Map<string, { alertAt?: string; firstHumanAt?: string; lastBeforeHuman?: string }>()
    for (const m of msgs ?? []) {
      const cid = m.conversation_id as string
      const entry = byConv.get(cid) ?? {}
      if (m.sender_type === 'human') {
        if (!entry.firstHumanAt) {
          entry.firstHumanAt = m.created_at as string
          entry.alertAt = entry.lastBeforeHuman
        }
      } else if (!entry.firstHumanAt) {
        entry.lastBeforeHuman = m.created_at as string
      }
      byConv.set(cid, entry)
    }

    const deltas: number[] = []
    for (const e of byConv.values()) {
      if (e.firstHumanAt && e.alertAt) {
        const d = new Date(e.firstHumanAt).getTime() - new Date(e.alertAt).getTime()
        if (d >= 0) deltas.push(d)
      }
    }
    if (deltas.length) {
      avgTakeoverMin = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length / 60000)
    }
  }

  // 24-bar hourly chart for today.
  const buckets = Array(24).fill(0) as number[]
  for (const c of todayConvs ?? []) {
    const h = new Date(c.created_at as string).getHours()
    buckets[h] = (buckets[h] || 0) + 1
  }

  const totalTodayCount = totalToday ?? 0

  // ── Comparativa semanal: this week vs last week ─────────────────────────
  const lastWeekStart = new Date(weekISO)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const { data: comparisonConvs } = await supabase
    .from('conversations')
    .select('id, status, created_at')
    .gte('created_at', lastWeekStart.toISOString())

  const thisWeekConvs = (comparisonConvs ?? []).filter(
    (c) => new Date(c.created_at as string) >= new Date(weekISO),
  )
  const lastWeekConvs = (comparisonConvs ?? []).filter(
    (c) => new Date(c.created_at as string) < new Date(weekISO),
  )
  const comparisonIds = (comparisonConvs ?? []).map((c) => c.id as string)

  type MsgRow = { conversation_id: string; sender_type: string; created_at: string; content: string }
  const messagesByConv = new Map<string, MsgRow[]>()
  if (comparisonIds.length) {
    const { data: cmpMsgs } = await supabase
      .from('messages')
      .select('conversation_id, sender_type, created_at, content')
      .in('conversation_id', comparisonIds)
      .order('created_at', { ascending: true })
    for (const m of (cmpMsgs ?? []) as MsgRow[]) {
      const arr = messagesByConv.get(m.conversation_id) ?? []
      arr.push(m)
      messagesByConv.set(m.conversation_id, arr)
    }
  }

  function summarize(convs: typeof thisWeekConvs): WeekStats {
    const total = convs.length
    let humanCount = 0
    let resolvedByBot = 0
    const responseTimes: number[] = []
    for (const c of convs) {
      const msgs = messagesByConv.get(c.id as string) ?? []
      const hasHuman = msgs.some((m) => m.sender_type === 'human')
      if (hasHuman) humanCount++
      if (c.status === 'resolved' && !hasHuman) resolvedByBot++
      const firstHumanIdx = msgs.findIndex((m) => m.sender_type === 'human')
      if (firstHumanIdx > 0) {
        const dt =
          new Date(msgs[firstHumanIdx].created_at).getTime() -
          new Date(msgs[firstHumanIdx - 1].created_at).getTime()
        if (dt >= 0) responseTimes.push(dt)
      }
    }
    return {
      total,
      botResolvedPct: total ? Math.round((resolvedByBot / total) * 100) : 0,
      humanPct:       total ? Math.round((humanCount    / total) * 100) : 0,
      avgResponseMin:
        responseTimes.length
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 60000)
          : null,
    }
  }

  const thisWeekStats = summarize(thisWeekConvs)
  const lastWeekStats = summarize(lastWeekConvs)

  // 14-day daily counts indexed from lastWeekStart (Monday two weeks ago).
  const dailyCounts = Array(14).fill(0) as number[]
  for (const c of comparisonConvs ?? []) {
    const dayOffset = Math.floor(
      (new Date(c.created_at as string).getTime() - lastWeekStart.getTime()) / 86_400_000,
    )
    if (dayOffset >= 0 && dayOffset < 14) dailyCounts[dayOffset]++
  }
  const lastWeekDaily = dailyCounts.slice(0, 7)
  const thisWeekDaily = dailyCounts.slice(7, 14)

  // Topic keyword frequency over THIS week's guest messages.
  const TOPICS: Array<{ label: string; rx: RegExp }> = [
    { label: 'Parking',        rx: /\b(parking|aparcamiento)\b/ },
    { label: 'Check-in',       rx: /\bcheck[\s-]?in\b|\bllegada\b/ },
    { label: 'Check-out',      rx: /\bcheck[\s-]?out\b|\bsalida\b/ },
    { label: 'Desayuno',       rx: /\bdesayun(o|os|ar)\b/ },
    { label: 'Cancelación',    rx: /\bcancelaci(o|on)\b|\bcancelar\b/ },
    { label: 'Precios',        rx: /\bprecio(s)?\b|\bcuanto (cuesta|vale)\b/ },
    { label: 'Habitaciones',   rx: /\bhabitaci(o|on|ones)\b/ },
    { label: 'Reservas',       rx: /\breserva(r|s|cion)?\b/ },
    { label: 'Mascotas',       rx: /\bmascota(s)?\b|\bperro(s)?\b|\bgato(s)?\b/ },
    { label: 'WiFi',           rx: /\bwi[\s-]?fi\b/ },
    { label: 'Spa',            rx: /\bspa\b/ },
    { label: 'Piscina',        rx: /\bpiscina\b/ },
    { label: 'Restaurante',    rx: /\brestaurante\b|\bcena\b|\bcomida\b/ },
  ]

  function normalize(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  }

  const keywordCounts = new Map<string, number>()
  for (const c of thisWeekConvs) {
    const msgs = messagesByConv.get(c.id as string) ?? []
    for (const m of msgs) {
      if (m.sender_type !== 'guest') continue
      const text = normalize(m.content)
      for (const t of TOPICS) {
        if (t.rx.test(text)) keywordCounts.set(t.label, (keywordCounts.get(t.label) ?? 0) + 1)
      }
    }
  }
  const topKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }))

  return (
    <div className="flex flex-col h-dvh">
      <AppHeader
        title="BoosterApp"
        role={profile.role}
        displayName={profile.display_name}
        hotelName={hotel?.name}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-5xl w-full mx-auto">
        <h1 className="text-lg font-semibold mb-4">Dashboard</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Conversaciones hoy" value={totalTodayCount} />
          <MetricCard label="Esta semana" value={totalWeek ?? 0} />
          <MetricCard
            label="Tiempo medio de respuesta"
            value={avgTakeoverMin == null ? '—' : `${avgTakeoverMin} min`}
            hint="Alerta → toma de mando"
          />
          <MetricCard
            label="Resueltas por el bot"
            value={pct(resolvedByBot, totalTodayCount)}
            hint={`${resolvedByBot} / ${totalTodayCount}`}
          />
          <MetricCard
            label="Con intervención humana"
            value={pct(requiredHuman, totalTodayCount)}
            hint={`${requiredHuman} / ${totalTodayCount}`}
          />
        </div>

        <div className="mt-6">
          <HourlyChart buckets={buckets} />
        </div>

        <ComparisonSection
          thisWeek={thisWeekStats}
          lastWeek={lastWeekStats}
          daily={{ lastWeek: lastWeekDaily, thisWeek: thisWeekDaily }}
          topKeywords={topKeywords}
        />

        <WeeklySummary />
      </main>
    </div>
  )
}
