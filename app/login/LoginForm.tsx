'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInError || !signInData.user) {
      setSubmitting(false)
      setError('Credenciales incorrectas')
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', signInData.user.id)
      .single()

    const dest = next || (profile?.role === 'admin' ? '/dashboard' : '/chat')
    router.replace(dest)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm mb-1" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="block text-sm mb-1" htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {error && (
        <p className="text-sm text-danger-fg bg-danger px-3 py-2 rounded-md">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-primary text-primary-fg py-2 text-sm font-medium disabled:opacity-60"
      >
        {submitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
