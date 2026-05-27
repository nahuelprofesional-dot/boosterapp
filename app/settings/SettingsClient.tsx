'use client'

import { useState, useTransition } from 'react'
import type { UserRole } from '@/lib/types'

interface UserRow {
  id: string
  display_name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

interface Props {
  initialUsers: UserRow[]
  currentUserId: string
}

export default function SettingsClient({ initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Create form state.
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ display_name: '', email: '', password: '', role: 'receptionist' as UserRole })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error ?? 'No se pudo crear el usuario')
      return
    }
    setUsers((u) => [...u, { ...body.user, created_at: new Date().toISOString() }])
    setForm({ display_name: '', email: '', password: '', role: 'receptionist' })
    setCreateOpen(false)
  }

  async function handleSave(id: string, patch: { display_name?: string; role?: UserRole }) {
    setError(null)
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error ?? 'No se pudo actualizar el usuario')
      return
    }
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, ...body.user } : x)))
    setEditingId(null)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name}? No se puede deshacer.`)) return
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? 'No se pudo eliminar el usuario')
        return
      }
      setUsers((u) => u.filter((x) => x.id !== id))
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-border bg-surface">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">{users.length} usuario{users.length === 1 ? '' : 's'}</span>
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="text-sm rounded-md bg-primary text-primary-fg px-3 py-1.5 font-medium"
          >
            {createOpen ? 'Cancelar' : '+ Nuevo'}
          </button>
        </header>

        {createOpen && (
          <form onSubmit={handleCreate} className="px-4 py-4 border-b border-border space-y-3 bg-bg/40">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="block mb-1 text-muted">Nombre</span>
                <input
                  required
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block text-sm">
                <span className="block mb-1 text-muted">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block text-sm">
                <span className="block mb-1 text-muted">Contraseña</span>
                <input
                  required
                  minLength={6}
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block text-sm">
                <span className="block mb-1 text-muted">Rol</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="receptionist">Recepción</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="text-sm rounded-md bg-primary text-primary-fg px-3 py-1.5 font-medium disabled:opacity-60"
            >
              Crear usuario
            </button>
          </form>
        )}

        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="px-4 py-3">
              {editingId === u.id ? (
                <EditRow
                  user={u}
                  onCancel={() => setEditingId(null)}
                  onSave={(patch) => handleSave(u.id, patch)}
                />
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {u.display_name}
                      {u.id === currentUserId && <span className="text-muted ml-2 text-xs">(tú)</span>}
                    </div>
                    <div className="text-xs text-muted truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${u.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-bg text-muted border border-border'}`}>
                      {u.role === 'admin' ? 'Admin' : 'Recepción'}
                    </span>
                    <button onClick={() => setEditingId(u.id)} className="text-xs text-muted hover:text-fg">Editar</button>
                    {u.id !== currentUserId && (
                      <button onClick={() => handleDelete(u.id, u.display_name)} className="text-xs text-danger hover:underline">
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function EditRow({
  user,
  onCancel,
  onSave,
}: {
  user: UserRow
  onCancel: () => void
  onSave: (patch: { display_name?: string; role?: UserRole }) => void
}) {
  const [name, setName] = useState(user.display_name)
  const [role, setRole] = useState<UserRole>(user.role)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const patch: { display_name?: string; role?: UserRole } = {}
        if (name.trim() && name !== user.display_name) patch.display_name = name.trim()
        if (role !== user.role) patch.role = role
        if (Object.keys(patch).length === 0) {
          onCancel()
          return
        }
        onSave(patch)
      }}
      className="flex flex-col sm:flex-row sm:items-center gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="receptionist">Recepción</option>
        <option value="admin">Admin</option>
      </select>
      <div className="flex items-center gap-2">
        <button type="submit" className="text-xs rounded-md bg-primary text-primary-fg px-3 py-1.5 font-medium">Guardar</button>
        <button type="button" onClick={onCancel} className="text-xs text-muted hover:text-fg">Cancelar</button>
      </div>
    </form>
  )
}
