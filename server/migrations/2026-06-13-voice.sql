-- Voice-cloning storage + settings.
-- Run in the Supabase SQL editor (or psql) against the ARIA project.

-- 1. Private bucket for reference clips.
insert into storage.buckets (id, name, public)
values ('voice-clips', 'voice-clips', false)
on conflict (id) do nothing;

-- 2. Voice profiles (one row per cloned voice).
create table if not exists public.voice_profiles (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  voice_id     text not null,
  name         text not null,
  storage_path text not null,
  created_at   timestamptz not null default now(),
  primary key (tenant_id, voice_id)
);

-- 3. Active-voice selection (one row per tenant).
create table if not exists public.voice_settings (
  tenant_id        uuid primary key references public.tenants(id) on delete cascade,
  active_voice_id  text
);
