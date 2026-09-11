-- Run once, manually, in the Supabase SQL editor for the production project.
-- Supports vibe.html becoming a real invite-creation page:
--   1. recipient_email becomes nullable — an invite shared via WhatsApp/copy
--      link has no recipient email on file, only a sender.
--   2. origin tracks which form created the invite ('home' vs 'vibe') for
--      the admin dashboard's per-origin breakdown. Existing rows default to
--      'home' since every invite before this migration came from the
--      homepage form.

alter table invites alter column recipient_email drop not null;

alter table invites add column if not exists origin text not null default 'home';

alter table invites add constraint invites_origin_check check (origin in ('home', 'vibe'));
