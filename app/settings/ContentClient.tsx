'use client'

import { useState } from 'react'
import type { HotelConfig } from '@/lib/types'

type Form = Omit<HotelConfig, 'hotel_id' | 'updated_at'>

const EMPTY: Form = {
  checkin_time: '',
  checkout_time: '',
  breakfast_hours: '',
  parking_available: false,
  parking_price: '',
  cancellation_policy: '',
  welcome_message: '',
  additional_info: '',
}

function withDefaults(c: HotelConfig | null): Form {
  if (!c) return EMPTY
  return {
    checkin_time: c.checkin_time ?? '',
    checkout_time: c.checkout_time ?? '',
    breakfast_hours: c.breakfast_hours ?? '',
    parking_available: !!c.parking_available,
    parking_price: c.parking_price ?? '',
    cancellation_policy: c.cancellation_policy ?? '',
    welcome_message: c.welcome_message ?? '',
    additional_info: c.additional_info ?? '',
  }
}

export default function ContentClient({ initialConfig }: { initialConfig: HotelConfig | null }) {
  const [form, setForm] = useState<Form>(withDefaults(initialConfig))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(initialConfig?.updated_at ?? null)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload: Form = {
        ...form,
        // Send empty strings as null so the DB doesn't store whitespace.
        checkin_time: form.checkin_time?.trim() || null as never,
        checkout_time: form.checkout_time?.trim() || null as never,
        breakfast_hours: form.breakfast_hours?.trim() || null as never,
        parking_price: form.parking_price?.trim() || null as never,
        cancellation_policy: form.cancellation_policy?.trim() || null as never,
        welcome_message: form.welcome_message?.trim() || null as never,
        additional_info: form.additional_info?.trim() || null as never,
      }
      const res = await fetch('/api/hotel-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'No se pudo guardar')
      setSavedAt(body.config?.updated_at ?? new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <Fieldset legend="Horarios">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Hora de check-in">
            <input
              type="text"
              placeholder="Ej. 15:00"
              value={form.checkin_time ?? ''}
              onChange={(e) => set('checkin_time', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Hora de check-out">
            <input
              type="text"
              placeholder="Ej. 11:00"
              value={form.checkout_time ?? ''}
              onChange={(e) => set('checkout_time', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Horario de desayuno" className="sm:col-span-2">
            <input
              type="text"
              placeholder="Ej. 07:30 a 10:30"
              value={form.breakfast_hours ?? ''}
              onChange={(e) => set('breakfast_hours', e.target.value)}
              className="input"
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Parking">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.parking_available}
              onChange={(e) => set('parking_available', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>El hotel ofrece parking</span>
          </label>
          {form.parking_available && (
            <Field label="Precio por noche" className="sm:col-span-2">
              <input
                type="text"
                placeholder="Ej. 12 € / noche o Gratuito"
                value={form.parking_price ?? ''}
                onChange={(e) => set('parking_price', e.target.value)}
                className="input"
              />
            </Field>
          )}
        </div>
      </Fieldset>

      <Fieldset legend="Política de cancelación">
        <Field>
          <textarea
            rows={3}
            placeholder="Ej. Cancelación gratuita hasta 48 h antes de la llegada."
            value={form.cancellation_policy ?? ''}
            onChange={(e) => set('cancellation_policy', e.target.value)}
            className="input min-h-[80px]"
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Mensaje de bienvenida">
        <Field>
          <textarea
            rows={3}
            placeholder="Primer mensaje que el bot envía al huésped."
            value={form.welcome_message ?? ''}
            onChange={(e) => set('welcome_message', e.target.value)}
            className="input min-h-[80px]"
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Información adicional">
        <Field>
          <textarea
            rows={4}
            placeholder="Cualquier dato extra que el bot deba conocer (servicios, restricciones, etc.)."
            value={form.additional_info ?? ''}
            onChange={(e) => set('additional_info', e.target.value)}
            className="input min-h-[100px]"
          />
        </Field>
      </Fieldset>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {savedAt ? `Última actualización: ${new Date(savedAt).toLocaleString('es-ES')}` : 'Sin guardar todavía'}
        </span>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary text-primary-fg px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid rgb(var(--color-border));
          background: rgb(var(--color-surface));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: rgb(var(--color-fg));
        }
        :global(.input:focus) {
          outline: none;
          box-shadow: 0 0 0 2px rgb(var(--color-primary) / 0.3);
        }
      `}</style>
    </form>
  )
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-medium mb-3">{legend}</h2>
      {children}
    </section>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={['block text-sm', className].filter(Boolean).join(' ')}>
      {label && <span className="block mb-1 text-muted">{label}</span>}
      {children}
    </label>
  )
}
