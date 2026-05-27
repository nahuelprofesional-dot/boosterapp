import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AppHeader from '@/components/AppHeader'
import ChatClient from './ChatClient'

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, hotel_id, display_name, email, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: hotel } = await supabase
    .from('hotels')
    .select('id, name')
    .eq('id', profile.hotel_id)
    .single()

  return (
    <div className="flex flex-col h-dvh">
      <AppHeader
        title="BoosterApp"
        role={profile.role}
        displayName={profile.display_name}
        hotelName={hotel?.name}
      />
      <Suspense fallback={<div className="flex-1 grid place-items-center text-sm text-muted">Cargando…</div>}>
        <ChatClient
          currentUserId={profile.id}
          displayName={profile.display_name}
          hotelId={profile.hotel_id}
          role={profile.role}
          vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''}
        />
      </Suspense>
    </div>
  )
}
