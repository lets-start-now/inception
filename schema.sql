-- ============================================================
-- Gamified Task & Habit Tracker — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Profiles (mirrors auth.users) ────────────────────────────
create table public.profiles (
  id       uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  role     text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- ── Tasks ─────────────────────────────────────────────────────
create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text default '',
  frequency        text not null default 'daily' check (frequency in ('daily', 'weekly')),
  type             text not null check (type in ('one-time', 'continuous')),
  points_per_action integer not null default 10 check (points_per_action > 0),
  daily_threshold  integer not null default 1   check (daily_threshold > 0),  -- per-period threshold (week for weekly tasks)
  is_active        boolean default true,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.tasks enable row level security;
create policy "tasks_select" on public.tasks for select using (true);
create policy "tasks_insert" on public.tasks for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "tasks_update" on public.tasks for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "tasks_delete" on public.tasks for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── Task logs (one row per user × task × day) ─────────────────
create table public.task_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete cascade not null,
  task_id       uuid references public.tasks(id)    on delete cascade not null,
  log_date      date not null default current_date,
  action_count  integer not null default 0,
  points_earned integer not null default 0,
  is_completed  boolean not null default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(user_id, task_id, log_date)
);

alter table public.task_logs enable row level security;
create policy "task_logs_select" on public.task_logs for select using (true);
create policy "task_logs_insert" on public.task_logs for insert with check (auth.uid() = user_id);
create policy "task_logs_update" on public.task_logs for update using (auth.uid() = user_id);

-- ── Daily summaries (one row per user × day) ──────────────────
create table public.daily_summaries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete cascade not null,
  summary_date     date not null default current_date,
  total_points     integer not null default 0,
  is_day_completed boolean not null default false,
  is_leader        boolean not null default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique(user_id, summary_date)
);

alter table public.daily_summaries enable row level security;
create policy "daily_summaries_select" on public.daily_summaries for select using (true);
create policy "daily_summaries_insert" on public.daily_summaries for insert with check (auth.uid() = user_id);
create policy "daily_summaries_update" on public.daily_summaries for update using (auth.uid() = user_id);

-- ── Streaks (one row per user × task) ─────────────────────────
create table public.streaks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete cascade not null,
  task_id            uuid references public.tasks(id)    on delete cascade not null,
  current_streak     integer not null default 0,
  longest_streak     integer not null default 0,
  is_habit           boolean not null default false,
  habit_start_date   date,
  last_completed_date date,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique(user_id, task_id)
);

alter table public.streaks enable row level security;
create policy "streaks_select" on public.streaks for select using (true);
create policy "streaks_insert" on public.streaks for insert with check (auth.uid() = user_id);
create policy "streaks_update" on public.streaks for update using (auth.uid() = user_id);

-- ── App settings (singleton row) ──────────────────────────────
create table public.app_settings (
  id                integer primary key default 1,
  min_daily_points  integer not null default 100,
  min_weekly_points integer not null default 300,
  updated_at        timestamptz default now()
);

alter table public.app_settings enable row level security;
create policy "app_settings_select" on public.app_settings for select using (true);
create policy "app_settings_update" on public.app_settings for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

insert into public.app_settings (id, min_daily_points) values (1, 100) on conflict do nothing;

-- ── Auto-create profile on sign-up ────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
