import Link from 'next/link'
import LogoutButton from './LogoutButton'
import ThemeToggle from './ThemeToggle'
import type { UserRole } from '@/lib/types'

interface Props {
  title: string
  role: UserRole
  displayName: string
  hotelName?: string
  rightSlot?: React.ReactNode
}

export default function AppHeader({ title, role, displayName, hotelName, rightSlot }: Props) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-semibold">{title}</span>
        {hotelName && <span className="text-xs text-muted truncate">· {hotelName}</span>}
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        {role === 'admin' && (
          <nav className="hidden sm:flex items-center gap-3 text-sm text-muted">
            <Link href="/chat" className="hover:text-fg">Chat</Link>
            <Link href="/dashboard" className="hover:text-fg">Dashboard</Link>
            <Link href="/leads" className="hover:text-fg">Leads</Link>
            <Link href="/history" className="hover:text-fg">Historial</Link>
            <Link href="/settings" className="hover:text-fg">Ajustes</Link>
          </nav>
        )}
        <span className="text-sm text-muted hidden sm:inline">Hola, {displayName}</span>
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  )
}
