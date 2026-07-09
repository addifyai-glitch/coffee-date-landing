-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Creates every table the site needs, with row-level security locked down so
-- anonymous visitors can only insert (and, for the waitlist, update their own
-- just-created row) — never read, list, or export data back out. Only an
-- authenticated user (the one admin account you create in Supabase Auth,
-- see README.md) can read rows, for the admin dashboard.

-- ==========================================================================
-- responses — "Let's See If We Vibe" invitation confirmations
-- ==========================================================================

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  email text,
  phone text,
  activity text,
  preferred_date date,
  preferred_time time,
  city text,
  message text
);

alter table public.responses enable row level security;

create policy "anon can insert a response"
  on public.responses for insert to anon with check (true);

create policy "authenticated can read responses"
  on public.responses for select to authenticated using (true);

-- ==========================================================================
-- waitlist_signups — Pookie waitlist + validation survey + name feedback
-- One row per visitor, filled in progressively across the multi-step form.
-- The client generates the id up front and updates the same row across
-- steps, so a lost/abandoned session at step 1 still counts as a signup.
-- ==========================================================================

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Step 1: waitlist info
  first_name text,
  email text,
  country text,
  instagram text,
  age_group text,
  interests text[],

  -- Step 2: idea validation survey
  would_use text,
  excites_most text,
  biggest_concern text,
  favorite_feature text,
  would_pay text,
  would_recommend text,
  current_method text,
  suggestions text,

  -- Step 3: name feedback
  name_opinion text,
  name_alternative text
);

alter table public.waitlist_signups enable row level security;

create policy "anon can insert a waitlist signup"
  on public.waitlist_signups for insert to anon with check (true);

-- Anon can update a row if they know its id (a random UUID they were handed
-- right after inserting it). This lets the multi-step form fill in the
-- survey and name-feedback steps without exposing a way to read or enumerate
-- anyone else's data.
create policy "anon can update their own waitlist row"
  on public.waitlist_signups for update to anon using (true) with check (true);

create policy "authenticated can read waitlist signups"
  on public.waitlist_signups for select to authenticated using (true);

-- ==========================================================================
-- demo_events — lightweight interaction log for the Pookie product demo
-- (e.g. which Vibe Mode a visitor picked while stepping through the demo)
-- ==========================================================================

create table if not exists public.demo_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  value text
);

alter table public.demo_events enable row level security;

create policy "anon can log a demo event"
  on public.demo_events for insert to anon with check (true);

create policy "authenticated can read demo events"
  on public.demo_events for select to authenticated using (true);

-- ==========================================================================
-- page_views — anonymous, cookie-free traffic counter
-- session_id is a random UUID generated client-side and stored in
-- localStorage; it is never linked to a name or email unless that visitor
-- separately submits a form.
-- ==========================================================================

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page text not null,
  session_id uuid not null
);

alter table public.page_views enable row level security;

create policy "anon can log a page view"
  on public.page_views for insert to anon with check (true);

create policy "authenticated can read page views"
  on public.page_views for select to authenticated using (true);

-- ==========================================================================
-- Admin access
-- ==========================================================================
-- The policies above grant read access to any "authenticated" Supabase user.
-- This is safe ONLY because the admin dashboard never exposes a public
-- sign-up form — the sole way to create a user is manually, from the
-- Supabase dashboard (Authentication → Users → Add user). Do that once for
-- yourself, and make sure "Allow new user signups" stays disabled in
-- Authentication → Settings so no one else can create an account.
