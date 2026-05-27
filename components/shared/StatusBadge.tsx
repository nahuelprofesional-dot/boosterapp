import type { ConversationStatus } from '@/lib/types'

const STYLES: Record<ConversationStatus, { label: string; className: string }> = {
  waiting:         { label: 'Alerta',     className: 'bg-danger  text-danger-fg' },
  offline_handoff: { label: 'Retomar',    className: 'bg-warning text-warning-fg' },
  human_active:    { label: 'Humano',     className: 'bg-info    text-info-fg' },
  bot_active:      { label: 'Bot activo', className: 'bg-success text-success-fg' },
  resolved:        { label: 'Resuelto',   className: 'bg-neutral text-neutral-fg' },
  archived:        { label: 'Archivada',  className: 'bg-surface-alt text-muted border border-border' },
}

export default function StatusBadge({ status }: { status: ConversationStatus }) {
  const s = STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  )
}
