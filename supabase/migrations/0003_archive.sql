-- Phase 2 feature 2: conversation archive.
-- Adds the 'archived' value to the conversation_status enum so resolved
-- conversations older than 7 days can be moved out of the active list.

alter type public.conversation_status add value if not exists 'archived';
