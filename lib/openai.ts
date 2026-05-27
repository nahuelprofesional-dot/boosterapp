// Minimal OpenAI wrapper around the official SDK. Reads OPENAI_API_KEY at
// call time so the rest of the app keeps working even if the key isn't set
// (the route surfaces a clear 503 error to the caller).

import OpenAI from 'openai'

export class MissingApiKeyError extends Error {
  constructor() {
    super('OPENAI_API_KEY not set on the server')
    this.name = 'MissingApiKeyError'
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model?: string
  system?: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  // Force the model to return strict JSON. Requires the prompt to mention "json".
  jsonMode?: boolean
}

export interface ChatResponse {
  text: string
  raw: unknown
}

export async function callOpenAI(opts: ChatOptions): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new MissingApiKeyError()

  const client = new OpenAI({ apiKey })

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
  if (opts.system) messages.push({ role: 'system', content: opts.system })
  for (const m of opts.messages) messages.push({ role: m.role, content: m.content })

  const completion = await client.chat.completions.create({
    model: opts.model ?? 'gpt-4o-mini',
    max_tokens: opts.max_tokens ?? 1024,
    temperature: opts.temperature ?? 0,
    messages,
    ...(opts.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  })

  const text = completion.choices[0]?.message?.content ?? ''
  return { text, raw: completion }
}

// Strip ```json fences a model sometimes adds, then JSON.parse.
export function parseJsonBlock<T = unknown>(text: string): T {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const payload = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(payload) as T
}
