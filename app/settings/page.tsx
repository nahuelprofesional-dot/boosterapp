import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import AppHeader from '@/components/AppHeader'
import SettingsTabs from './SettingsTabs'
import SettingsClient from './SettingsClient'
import ContentClient from './ContentClient'
import AppearanceClient from './AppearanceClient'
import DataClient from './DataClient'

export const dynamic = 'force-dynamic'

const TABS = ['users', 'content', 'appearance', 'data'] as const
type Tab = (typeof TABS)[number]

function defaultWidgetUrl() {
  // Prefer an explicit env var; otherwise fall back to <origin>/widget/v1.js
  // so the snippet works as soon as the widget is hosted on the app domain.
  const env = process.env.NEXT_PUBLIC_WIDGET_URL
  if (env) return env
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}/widget/v1.js` : 'https://your-domain.com/widget/v1.js'
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
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

  const tab: Tab = TABS.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : 'users'

  const { data: hotel } = await supabase
    .from('hotels').select('id, name').eq('id', profile.hotel_id).single()

  let usersList: Array<{ id: string; display_name: string; email: string; role: 'admin' | 'receptionist'; is_active: boolean; created_at: string }> = []
  let config: Awaited<ReturnType<typeof getConfig>> = null
  let archivedCount = 0

  async function getConfig() {
    const { data } = await supabase
      .from('hotel_config')
      .select('*')
      .eq('hotel_id', profile!.hotel_id)
      .maybeSingle()
    return data
  }

  if (tab === 'users') {
    const { data } = await supabase
      .from('users')
      .select('id, display_name, email, role, is_active, created_at')
      .eq('hotel_id', profile.hotel_id)
      .order('created_at', { ascending: true })
    usersList = data ?? []
  } else if (tab === 'content' || tab === 'appearance') {
    config = await getConfig()
  } else if (tab === 'data') {
    const { count } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'archived')
    archivedCount = count ?? 0
  }

  return (
    <div className="flex flex-col h-dvh">
      <AppHeader
        title="BoosterApp"
        role={profile.role}
        displayName={profile.display_name}
        hotelName={hotel?.name}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-5xl w-full mx-auto">
        <h1 className="text-lg font-semibold mb-1">Ajustes del hotel</h1>
        <p className="text-sm text-muted mb-5">
          Administra el equipo, el contenido del bot y los datos de {hotel?.name ?? 'tu hotel'}.
        </p>

        <SettingsTabs current={tab} />

        <div className="mt-5">
          {tab === 'users' && (
            <SettingsClient initialUsers={usersList} currentUserId={profile.id} />
          )}
          {tab === 'content' && <ContentClient initialConfig={config} />}
          {tab === 'appearance' && (
            <AppearanceClient
              initialConfig={config}
              hotelId={profile.hotel_id}
              widgetScriptUrl={defaultWidgetUrl()}
            />
          )}
          {tab === 'data' && <DataClient initialArchivedCount={archivedCount} />}
        </div>
      </main>
    </div>
  )
}
