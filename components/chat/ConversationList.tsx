'use client'

import StatusBadge from '@/components/shared/StatusBadge'
import type { ConversationWithLastMessage } from '@/lib/types'

interface Props {
  conversations: ConversationWithLastMessage[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

export default function ConversationList({ conversations, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="p-6 text-sm text-muted text-center">
        Aún no hay conversaciones.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {conversations.map((c) => {
        const isSelected = c.id === selectedId
        const accent =
          c.status === 'waiting'
            ? 'border-l-danger-fg'
            : c.status === 'offline_handoff'
            ? 'border-l-warning-fg'
            : 'border-l-transparent'
        return (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c.id)}
              className={[
                'w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors border-l-4',
                accent,
                isSelected ? 'bg-surface-alt' : 'bg-surface hover:bg-surface-alt',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">
                  {c.guest_name || 'Guest'}
                </span>
                <span className="text-[11px] text-muted shrink-0">{formatRelative(c.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted truncate">
                  {c.last_message?.content || 'Sin mensajes aún'}
                </span>
                <StatusBadge status={c.status} />
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
