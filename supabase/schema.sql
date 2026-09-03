-- Run this once, manually, in the SQL editor of the NEW, isolated Supabase
-- project (Project → SQL Editor → New query). This project must be separate
-- from any other Addify Supabase project.
--
-- Row-level security is enabled on every table with NO policies attached —
-- anon and authenticated both get zero access. Every read/write goes through
-- the /api/* serverless functions using the service role key, which bypasses
-- RLS entirely. The browser never talks to Supabase directly.

create extension if not exists pgcrypto;

-- ==========================================================================
-- waitlist
-- ==========================================================================

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,            -- stored lowercased + trimmed
  name text,
  city text,
  source text,                           -- 'landing' | 'invite' | 'referral'
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referral_code text not null unique,    -- nanoid(8), url-safe
  referred_by text,                      -- referral_code of referrer
  referral_count int not null default 0, -- confirmed referrals only
  position int not null,                 -- assigned at insert: max(position)+1
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);

-- ==========================================================================
-- invites
-- ==========================================================================

create table invites (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null,
  sender_email text not null,
  recipient_name text,
  recipient_email text not null,
  place text not null,
  starts_at timestamptz not null,
  timezone text not null default 'Europe/Vienna',
  message text,
  status text not null default 'pending', -- pending | accepted | declined | proposed | expired
  proposed_starts_at timestamptz,         -- set when recipient proposes a new time
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  ip_hash text
);

-- ==========================================================================
-- rate_limits
-- ==========================================================================

create table rate_limits (
  key text primary key,                   -- '<endpoint>:<ip_hash>'
  count int not null default 0,
  window_start timestamptz not null default now()
);

alter table waitlist enable row level security;
alter table invites enable row level security;
alter table rate_limits enable row level security;
-- No policies on purpose: anon/authenticated get nothing. Service role bypasses RLS.

-- ==========================================================================
-- vibe_responses — "Let's See If We Vibe" invitation confirmations
-- The restored personal-invite easter egg at /vibe.html. Same access model
-- as everything else: service role only, no anon/authenticated policies.
-- ==========================================================================

create table vibe_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  email text,
  phone text,
  activity text,
  preferred_date date,
  preferred_time text,
  city text,
  message text,
  ip_hash text
);

alter table vibe_responses enable row level security;
-- No policies on purpose: anon/authenticated get nothing. Service role bypasses RLS.
