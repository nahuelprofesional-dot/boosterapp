import type { Message } from '@/lib/types'
import UserAvatar from '@/components/shared/UserAvatar'

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, botLabel = 'L' }: { message: Message; botLabel?: string }) {
  const isGuest = message.sender_type === 'guest'
  const isBot = message.sender_type === 'bot'

  if (isGuest) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-tr-sm bg-info text-info-fg px-3 py-2 text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
          <div className="text-[10px] text-muted text-right mt-1">{formatTime(message.created_at)}</div>
        </div>
      </div>
    )
  }

  const tone: 'bot' | 'human' = isBot ? 'bot' : 'human'
  const bubbleClass = isBot
    ? 'bg-surface-alt text-fg border border-border'
    : 'bg-warning text-warning-fg'
  const avatarName = isBot ? botLabel : (message.sender_name || '?')

  return (
    <div className="flex justify-start gap-2">
      <UserAvatar name={avatarName} tone={tone} />
      <div className="max-w-[80%]">
        {!isBot && message.sender_name && (
          <div className="text-[10px] text-muted mb-1">{message.sender_name}</div>
        )}
        <div className={`rounded-2xl rounded-tl-sm px-3 py-2 text-sm whitespace-pre-wrap break-words ${bubbleClass}`}>
          {message.content}
        </div>
        <div className="text-[10px] text-muted mt-1">{formatTime(message.created_at)}</div>
      </div>
    </div>
  )
}
