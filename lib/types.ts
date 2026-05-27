export type UserRole = 'admin' | 'receptionist'
export type ConversationStatus = 'bot_active' | 'waiting' | 'offline_handoff' | 'human_active' | 'resolved' | 'archived'
export type SenderType = 'guest' | 'bot' | 'human'

export interface Hotel {
  id: string
  name: string
  created_at: string
}

export interface UserProfile {
  id: string
  hotel_id: string
  display_name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Conversation {
  id: string
  hotel_id: string
  session_id: string
  guest_name: string | null
  channel: string
  status: ConversationStatus
  assigned_to: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: SenderType
  sender_name: string | null
  content: string
  created_at: string
}

export interface ConversationWithLastMessage extends Conversation {
  last_message?: Message | null
}

export type LeadInterestLevel = 'alta' | 'media' | 'baja'

export interface Lead {
  id: string
  conversation_id: string
  guest_name: string | null
  dates_interest: string | null
  room_type: string | null
  interest_level: LeadInterestLevel
  summary: string
  created_at: string
  updated_at: string
}

export interface HotelConfig {
  hotel_id: string
  checkin_time: string | null
  checkout_time: string | null
  breakfast_hours: string | null
  parking_available: boolean
  parking_price: string | null
  cancellation_policy: string | null
  welcome_message: string | null
  additional_info: string | null
  bot_name: string | null
  bot_tone: string | null
  theme_name: string | null
  primary_color: string | null
  accent_color: string | null
  updated_at: string
}
