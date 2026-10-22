-- TERPN backend handoff schema
-- PostgreSQL-oriented contract for moving the local-first prototype into production storage.
-- Keep protected/private journal fields access-controlled at the API layer and encrypted at rest where available.

create extension if not exists pgcrypto;

create table if not exists terpn_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text not null default '',
  role text not null default 'member' check (role in ('member', 'creator', 'reviewer', 'admin')),
  plan text not null default 'starter' check (plan in ('starter', 'explorer', 'studio')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists terpn_profiles (
  user_id uuid primary key references terpn_users(id) on delete cascade,
  goal text not null default 'learn',
  aroma text not null default 'citrus',
  sensitivity text not null default 'standard',
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists terpn_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references terpn_users(id) on delete cascade,
  client_record_id text,
  title text not null default 'Untitled reflection',
  entry_date date not null default current_date,
  terpenes text not null default '',
  setting text not null default '',
  before_state text not null default '',
  after_state text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, client_record_id)
);

create table if not exists terpn_signup_interests (
  id uuid primary key default gen_random_uuid(),
  client_record_id text,
  email text not null,
  name text not null default '',
  plan text not null default 'starter',
  role text not null default 'personal journal',
  note text not null default '',
  source text not null default 'prototype',
  created_at timestamptz not null default now(),
  converted_user_id uuid references terpn_users(id) on delete set null
);

create table if not exists terpn_consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references terpn_users(id) on delete cascade,
  consent_key text not null,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);

create table if not exists terpn_content_review_notes (
  id uuid primary key default gen_random_uuid(),
  reviewer_user_id uuid references terpn_users(id) on delete set null,
  content_type text not null,
  content_key text not null,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'archived')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists terpn_journal_entries_user_date_idx on terpn_journal_entries(user_id, entry_date desc) where deleted_at is null;
create index if not exists terpn_signup_interests_email_idx on terpn_signup_interests(lower(email));
create index if not exists terpn_consent_records_user_key_idx on terpn_consent_records(user_id, consent_key, consented_at desc);
