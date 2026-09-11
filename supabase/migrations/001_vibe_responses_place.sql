-- Run once, manually, in the Supabase SQL editor for the production project.
-- Adds the optional "place" field to vibe_responses (still used by the old
-- /api/vibe endpoint's saved rows, independent of the invites-table work in
-- migration 002). Safe to run even though the app already tolerates this
-- column being absent (it degrades gracefully until this runs).

alter table vibe_responses add column if not exists place text;
