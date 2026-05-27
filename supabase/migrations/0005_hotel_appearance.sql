-- Phase 2 feature 7: chatbot appearance customization.
-- Extends hotel_config with the fields the admin can tune from /settings → Apariencia.

alter table public.hotel_config
  add column if not exists bot_name       text,
  add column if not exists bot_tone       text,
  add column if not exists theme_name     text,
  add column if not exists primary_color  text,
  add column if not exists accent_color   text;
