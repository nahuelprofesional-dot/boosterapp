'use client'

import { useEffect, useMemo, useState } from 'react'
import type { HotelConfig } from '@/lib/types'

interface Theme {
  key: string
  label: string
  primary: string
  accent: string
}

const THEMES: Theme[] = [
  { key: 'mediterraneo', label: 'Mediterráneo', primary: '#1a2744', accent: '#b8956a' },
  { key: 'bosque',       label: 'Bosque',       primary: '#2d4a3e', accent: '#8fba74' },
  { key: 'urbano',       label: 'Urbano',       primary: '#1a1a1a', accent: '#e63946' },
  { key: 'nordico',      label: 'Nórdico',      primary: '#2c4a6e', accent: '#a8c5da' },
  { key: 'atardecer',    label: 'Atardecer',    primary: '#6b3a2a', accent: '#e8956d' },
  { key: 'custom',       label: 'Personalizado', primary: '#3b82f6', accent: '#fbbf24' },
]

const TONES: Array<{ value: string; label: string }> = [
  { value: 'cercano',      label: 'Cercano y cálido' },
  { value: 'profesional',  label: 'Profesional y formal' },
  { value: 'neutro',       label: 'Neutro' },
]

const DEFAULT_BOT_NAME = 'Lara'
const DEFAULT_WELCOME = 'Hola, ¿en qué puedo ayudarte?'
const DEFAULT_TONE = 'cercano'
const DEFAULT_THEME = 'mediterraneo'

interface Form {
  bot_name: string
  welcome_message: string
  bot_tone: string
  theme_name: string
  primary_color: string
  accent_color: string
}

function withDefaults(c: HotelConfig | null): Form {
  const theme = THEMES.find((t) => t.key === (c?.theme_name ?? DEFAULT_THEME)) ?? THEMES[0]
  return {
    bot_name:        c?.bot_name        ?? DEFAULT_BOT_NAME,
    welcome_message: c?.welcome_message ?? DEFAULT_WELCOME,
    bot_tone:        c?.bot_tone        ?? DEFAULT_TONE,
    theme_name:      c?.theme_name      ?? theme.key,
    primary_color:   c?.primary_color   ?? theme.primary,
    accent_color:    c?.accent_color    ?? theme.accent,
  }
}

interface Props {
  initialConfig: HotelConfig | null
  hotelId: string
  widgetScriptUrl: string
}

export default function AppearanceClient({ initialConfig, hotelId, widgetScriptUrl }: Props) {
  const [form, setForm] = useState<Form>(() => withDefaults(initialConfig))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(id)
  }, [toast])

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function selectTheme(themeKey: string) {
    const t = THEMES.find((t) => t.key === themeKey)
    if (!t) return
    if (themeKey === 'custom') {
      // Keep current colors as the starting point for custom edits.
      set('theme_name', 'custom')
      return
    }
    setForm((f) => ({ ...f, theme_name: t.key, primary_color: t.primary, accent_color: t.accent }))
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/hotel-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_name: form.bot_name.trim() || null,
          welcome_message: form.welcome_message.trim() || null,
          bot_tone: form.bot_tone,
          theme_name: form.theme_name,
          primary_color: form.primary_color,
          accent_color: form.accent_color,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'No se pudo guardar')
      setToast('Cambios guardados')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const snippet = useMemo(() => buildSnippet({
    widgetScriptUrl,
    hotelId,
    botName: form.bot_name,
    welcome: form.welcome_message,
    primary: form.primary_color,
    accent: form.accent_color,
  }), [widgetScriptUrl, hotelId, form.bot_name, form.welcome_message, form.primary_color, form.accent_color])

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('No se pudo copiar al portapapeles')
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* LEFT — controls */}
        <div className="space-y-6 min-w-0">
          {/* Identity */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-medium mb-3">Identidad del bot</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="block mb-1 text-muted text-xs">Nombre del bot</span>
                <input
                  type="text"
                  value={form.bot_name}
                  onChange={(e) => set('bot_name', e.target.value)}
                  placeholder="Ej. Lara, María, Julián"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block text-sm">
                <span className="block mb-1 text-muted text-xs">Mensaje de bienvenida</span>
                <textarea
                  rows={2}
                  value={form.welcome_message}
                  onChange={(e) => set('welcome_message', e.target.value)}
                  placeholder="El primer mensaje que verá el huésped."
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[64px]"
                />
              </label>
              <label className="block text-sm">
                <span className="block mb-1 text-muted text-xs">Tono</span>
                <select
                  value={form.bot_tone}
                  onChange={(e) => set('bot_tone', e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>
          </section>

          {/* Theme gallery */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-medium mb-3">Estilo visual</h2>
            <p className="text-xs text-muted mb-3">Elige un tema o personaliza los colores.</p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEMES.map((t) => {
                const selected = form.theme_name === t.key
                const display = t.key === 'custom' && selected
                  ? { primary: form.primary_color, accent: form.accent_color }
                  : { primary: t.primary, accent: t.accent }
                return (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => selectTheme(t.key)}
                      aria-pressed={selected}
                      className={[
                        'w-full text-left rounded-lg border transition-colors p-2',
                        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-muted',
                      ].join(' ')}
                    >
                      <ThemePreviewMini primary={display.primary} accent={display.accent} botName={form.bot_name || DEFAULT_BOT_NAME} />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-medium truncate">{t.label}</span>
                        {selected && <CheckIcon />}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>

            {form.theme_name === 'custom' && (
              <div className="mt-4 grid sm:grid-cols-2 gap-3 pt-4 border-t border-border">
                <ColorField
                  label="Color principal"
                  value={form.primary_color}
                  onChange={(v) => set('primary_color', v)}
                />
                <ColorField
                  label="Color de acento"
                  value={form.accent_color}
                  onChange={(v) => set('accent_color', v)}
                />
              </div>
            )}
          </section>

          {/* Install snippet */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-medium mb-1">Instalar en tu web</h2>
            <p className="text-xs text-muted mb-3">
              Pega este código antes del <code>&lt;/body&gt;</code> de tu web para activar el chat.
            </p>
            <pre className="rounded-md border border-border bg-surface-alt p-3 text-xs overflow-x-auto font-mono whitespace-pre">
              <code>{snippet}</code>
            </pre>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted">
                {copied ? '¡Copiado!' : 'Lleva tus colores y mensaje de bienvenida ya aplicados.'}
              </span>
              <button
                onClick={copySnippet}
                className="rounded-md bg-primary text-primary-fg px-3 py-1.5 text-sm font-medium"
              >
                Copiar código
              </button>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary text-primary-fg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        {/* RIGHT — live preview */}
        <aside className="lg:sticky lg:top-4 self-start">
          <h2 className="text-sm font-medium mb-2">Vista previa en vivo</h2>
          <WidgetPreview
            botName={form.bot_name || DEFAULT_BOT_NAME}
            welcome={form.welcome_message || DEFAULT_WELCOME}
            primary={form.primary_color}
            accent={form.accent_color}
          />
        </aside>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 rounded-full bg-fg text-bg px-4 py-2 text-sm shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="text-sm">
      <span className="block mb-1 text-muted text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-9 w-12 rounded-md border border-border bg-surface cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-primary">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function initialsOf(name: string): string {
  return (name.trim().split(/\s+/).map((p) => p[0]).join('') || '?').slice(0, 2).toUpperCase()
}

// ── Mini theme card preview ───────────────────────────────────────────────────
function ThemePreviewMini({ primary, accent, botName }: { primary: string; accent: string; botName: string }) {
  return (
    <div className="rounded-md overflow-hidden border border-black/10 shadow-sm bg-white">
      <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ background: primary, color: '#fff' }}>
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold"
          style={{ background: accent, color: primary }}
        >
          {initialsOf(botName)}
        </span>
        <span className="text-[9px] font-medium truncate flex-1">{botName}</span>
      </div>
      <div className="px-2 py-2 space-y-1" style={{ background: '#f8fafc' }}>
        <div className="flex">
          <div className="rounded-md text-[8px] px-1.5 py-1 max-w-[80%]" style={{ background: '#fff', color: '#1f2937', border: '1px solid #e5e7eb' }}>
            Hola!
          </div>
        </div>
        <div className="flex justify-end">
          <div className="rounded-md text-[8px] px-1.5 py-1 max-w-[80%]" style={{ background: accent, color: primary }}>
            ¿Disponibilidad?
          </div>
        </div>
      </div>
      <div className="px-2 py-1.5 flex justify-end" style={{ background: '#fff' }}>
        <span className="rounded text-[8px] px-2 py-1 font-medium" style={{ background: primary, color: '#fff' }}>
          Enviar
        </span>
      </div>
    </div>
  )
}

// ── Full live preview (right column) ──────────────────────────────────────────
function WidgetPreview({ botName, welcome, primary, accent }: { botName: string; welcome: string; primary: string; accent: string }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border border-black/10 w-full max-w-[320px] mx-auto bg-white" aria-label="Vista previa del widget">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: primary, color: '#fff' }}>
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shadow"
          style={{ background: accent, color: primary }}
        >
          {initialsOf(botName)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{botName}</div>
          <div className="text-[10px] opacity-80 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden />
            En línea
          </div>
        </div>
        <button aria-label="Cerrar" className="opacity-80 hover:opacity-100 text-lg leading-none">×</button>
      </div>

      {/* Body */}
      <div className="px-3 py-3 space-y-2.5 min-h-[200px]" style={{ background: '#f8fafc' }}>
        {/* Bot welcome bubble */}
        <div className="flex items-start gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold shrink-0"
            style={{ background: accent, color: primary }}
          >
            {initialsOf(botName)}
          </span>
          <div
            className="rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap"
            style={{ background: '#fff', color: '#1f2937', border: '1px solid #e5e7eb' }}
          >
            {welcome}
          </div>
        </div>

        {/* Sample guest bubble */}
        <div className="flex justify-end">
          <div
            className="rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[80%]"
            style={{ background: accent, color: primary }}
          >
            ¿Tenéis disponibilidad este fin de semana?
          </div>
        </div>

        {/* Sample bot reply */}
        <div className="flex items-start gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold shrink-0"
            style={{ background: accent, color: primary }}
          >
            {initialsOf(botName)}
          </span>
          <div
            className="rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[80%]"
            style={{ background: '#fff', color: '#1f2937', border: '1px solid #e5e7eb' }}
          >
            ¡Sí! Déjame ver opciones para ti.
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-2 py-2 border-t" style={{ background: '#fff', borderColor: '#e5e7eb' }}>
        <input
          type="text"
          placeholder="Escribe tu mensaje…"
          readOnly
          className="flex-1 rounded-full px-3 py-1.5 text-xs outline-none"
          style={{ background: '#f8fafc', color: '#1f2937', border: '1px solid #e5e7eb' }}
        />
        <button
          aria-label="Enviar"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shadow"
          style={{ background: primary, color: '#fff' }}
        >
          ➤
        </button>
      </div>
    </div>
  )
}

// ── Snippet generator ─────────────────────────────────────────────────────────
function buildSnippet(opts: {
  widgetScriptUrl: string
  hotelId: string
  botName: string
  welcome: string
  primary: string
  accent: string
}): string {
  const esc = (s: string) => s.replace(/"/g, '&quot;')
  return `<!-- BoosterApp chatbot widget -->
<script
  src="${opts.widgetScriptUrl}"
  data-hotel-id="${esc(opts.hotelId)}"
  data-bot-name="${esc(opts.botName)}"
  data-welcome-message="${esc(opts.welcome)}"
  data-primary-color="${opts.primary}"
  data-accent-color="${opts.accent}"
  async>
</script>`
}
