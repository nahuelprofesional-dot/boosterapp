// Minimal Anthropic API wrapper. Uses native fetch — no SDK dependency.
// Reads ANTHROPIC_API_KEY at call time so the rest of the app keeps working
// even if the key isn't set (the route will surface a clear error).

const API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export class MissingApiKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY not set on the server')
    this.name = 'MissingApiKeyError'
  }
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeOptions {
  model?: string
  system?: string
  messages: ClaudeMessage[]
  max_tokens?: number
  temperature?: number
}

export interface ClaudeResponse {
  text: string
  raw: unknown
}

export async function callClaude(opts: ClaudeOptions): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new MissingApiKeyError()

  const body = {
    model: opts.model ?? 'claude-haiku-4-5-20251001',
    max_tokens: opts.max_tokens ?? 1024,
    temperature: opts.temperature ?? 0,
    system: opts.system,
    messages: opts.messages,
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 500)}`)
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const text = (json.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
  return { text, raw: json }
}

// Strip ```json fences a model sometimes adds, then JSON.parse.
export function parseJsonBlock<T = unknown>(text: string): T {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const payload = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(payload) as T
}
