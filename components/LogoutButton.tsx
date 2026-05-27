'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.replace('/login')
        router.refresh()
      }}
      className="text-xs text-muted hover:text-fg"
    >
      Salir
    </button>
  )
}
