// Hardcoded data for the /demo route. Lives entirely in client memory —
// no Supabase, no network, no realtime. Independent from the MVP code path.

import type { Conversation, Message } from './types'

export interface DemoState {
  conversations: Conversation[]
  messagesByConv: Record<string, Message[]>
}

const HOTEL_ID = 'demo-hotel'
const USER_ID = 'demo-user'

function iso(minsAgo: number) {
  return new Date(Date.now() - minsAgo * 60_000).toISOString()
}

let counter = 0
const uid = () => `demo-${++counter}`

export function seed(): DemoState {
  counter = 0

  const c1: Conversation = {
    id: uid(),
    hotel_id: HOTEL_ID,
    session_id: 'sess-marta',
    guest_name: 'Marta',
    channel: 'web',
    status: 'waiting',
    assigned_to: null,
    created_at: iso(14),
    updated_at: iso(3),
  }
  const c2: Conversation = {
    id: uid(),
    hotel_id: HOTEL_ID,
    session_id: 'sess-luis',
    guest_name: 'Luis',
    channel: 'web',
    status: 'human_active',
    assigned_to: USER_ID,
    created_at: iso(35),
    updated_at: iso(6),
  }
  const c3: Conversation = {
    id: uid(),
    hotel_id: HOTEL_ID,
    session_id: 'sess-emma',
    guest_name: 'Emma Lloyd',
    channel: 'web',
    status: 'bot_active',
    assigned_to: null,
    created_at: iso(50),
    updated_at: iso(45),
  }
  const c4: Conversation = {
    id: uid(),
    hotel_id: HOTEL_ID,
    session_id: 'sess-anon',
    guest_name: null,
    channel: 'web',
    status: 'resolved',
    assigned_to: USER_ID,
    created_at: iso(180),
    updated_at: iso(120),
  }

  const m = (
    conversation_id: string,
    sender_type: Message['sender_type'],
    content: string,
    minsAgo: number,
    sender_name: string | null = null
  ): Message => ({
    id: uid(),
    conversation_id,
    sender_type,
    sender_name,
    content,
    created_at: iso(minsAgo),
  })

  const messagesByConv: Record<string, Message[]> = {
    [c1.id]: [
      m(c1.id, 'guest', 'Hola, ¿el check-in se puede hacer a las 4 de la mañana?', 14),
      m(c1.id, 'bot', 'Buenas. Nuestra recepción está abierta 24h. Necesitarías avisarnos antes de las 22h para coordinar la llegada de madrugada.', 13, 'Bot'),
      m(c1.id, 'guest', 'Vale, ¿y puedo dejar el coche en el parking esa noche?', 6),
      m(c1.id, 'guest', '¿Hay alguien que me confirme? Es urgente, salgo en 1 hora.', 3),
    ],
    [c2.id]: [
      m(c2.id, 'guest', 'Buenas, llegamos hoy con un perro pequeño, ¿hay algún problema?', 35),
      m(c2.id, 'bot', 'Hola. Aceptamos mascotas hasta 10 kg con un suplemento de 15€/noche.', 34, 'Bot'),
      m(c2.id, 'guest', 'Perfecto. Una última cosa: ¿la habitación da al patio interior o a la calle? La reserva no lo dice.', 12),
      m(c2.id, 'human', 'Hola Luis, soy Jorge de recepción. He revisado y te he asignado la 312, da al patio interior. Mucho más silenciosa.', 8, 'Jorge'),
      m(c2.id, 'guest', '¡Genial, mil gracias!', 6),
    ],
    [c3.id]: [
      m(c3.id, 'guest', 'What time is breakfast served?', 50),
      m(c3.id, 'bot', 'Breakfast is served from 7:30 to 10:30 in the main dining room.', 49, 'Bot'),
      m(c3.id, 'guest', 'Thanks!', 45),
    ],
    [c4.id]: [
      m(c4.id, 'guest', 'Necesito factura con CIF de empresa.', 180),
      m(c4.id, 'human', 'Sin problema, te la enviamos hoy al email de la reserva.', 130, 'Jorge'),
      m(c4.id, 'guest', 'Perfecto, gracias.', 125),
    ],
  }

  return {
    conversations: [c1, c2, c3, c4],
    messagesByConv,
  }
}

export const DEMO_USER = {
  id: USER_ID,
  hotel_id: HOTEL_ID,
  display_name: 'Jorge',
  role: 'admin' as const,
  hotel_name: 'Hotel Demo',
}
