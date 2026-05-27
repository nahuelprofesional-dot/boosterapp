'use client'

import Link from 'next/link'

const tabs = [
  { key: 'users', label: 'Usuarios' },
  { key: 'content', label: 'Contenido del bot' },
  { key: 'appearance', label: 'Apariencia' },
  { key: 'data', label: 'Datos' },
] as const

export default function SettingsTabs({ current }: { current: 'users' | 'content' | 'appearance' | 'data' }) {
  return (
    <nav className="flex items-center gap-1 border-b border-border overflow-x-auto" aria-label="Ajustes">
      {tabs.map((t) => {
        const active = current === t.key
        return (
          <Link
            key={t.key}
            href={`/settings?tab=${t.key}`}
            scroll={false}
            className={[
              'shrink-0 px-3 py-2 text-sm rounded-t-md border-b-2 -mb-px whitespace-nowrap',
              active
                ? 'border-primary text-fg font-medium'
                : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
