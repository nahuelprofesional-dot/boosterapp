interface Props {
  name: string | null | undefined
  fallback?: string
  tone?: 'bot' | 'human' | 'guest'
}

const TONES: Record<NonNullable<Props['tone']>, string> = {
  bot:   'bg-neutral text-neutral-fg',
  human: 'bg-warning text-warning-fg',
  guest: 'bg-info text-info-fg',
}

export default function UserAvatar({ name, fallback = '?', tone = 'bot' }: Props) {
  const initial = (name && name.trim().charAt(0)) || fallback
  return (
    <div className={`h-7 w-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${TONES[tone]}`}>
      {initial.toUpperCase()}
    </div>
  )
}
