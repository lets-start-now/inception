-- ── New tables ───────────────────────────────────────────────────────────────

create table if not exists public.user_task_schedule (
  user_id     uuid    not null references public.profiles(id) on delete cascade,
  task_id     uuid    not null references public.tasks(id)    on delete cascade,
  active_days int[]   not null default '{0,1,2,3,4,5,6}',
  updated_at  timestamptz default now(),
  primary key (user_id, task_id)
);

create table if not exists public.user_task_day_override (
  user_id       uuid    not null references public.profiles(id) on delete cascade,
  task_id       uuid    not null references public.tasks(id)    on delete cascade,
  override_date date    not null,
  is_active     boolean not null,
  created_at    timestamptz default now(),
  primary key (user_id, task_id, override_date)
);

alter table public.user_task_schedule     enable row level security;
alter table public.user_task_day_override enable row level security;

create policy "users_own_schedule"
  on public.user_task_schedule
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_own_overrides"
  on public.user_task_day_override
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Helper: is task active for this user on a given date? ────────────────────
-- Override beats template; no template row = active every day (default).
-- Weekday convention: 0 = Monday … 6 = Sunday (ISO, matches date-fns/JS shift).

create or replace function public._is_task_active_on(
  p_user_id uuid,
  p_task_id uuid,
  p_date    date
) returns boolean
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_override    boolean;
  v_active_days int[];
  v_dow         int;
begin
  select is_active into v_override
  from public.user_task_day_override
  where user_id = p_user_id and task_id = p_task_id and override_date = p_date;
  if found then return v_override; end if;

  select active_days into v_active_days
  from public.user_task_schedule
  where user_id = p_user_id and task_id = p_task_id;
  if not found then return true; end if;

  -- extract(dow) gives 0=Sun…6=Sat; shift to 0=Mon…6=Sun
  v_dow := ((extract(dow from p_date)::int + 6) % 7);
  return v_dow = any(v_active_days);
end;
$$;

-- ── Helper: count ACTIVE days strictly between p_from and p_to ───────────────
-- Used by _update_streak to decide whether a gap is bridged by passive days.

create or replace function public._active_days_between(
  p_user_id uuid,
  p_task_id uuid,
  p_from    date,
  p_to      date
) returns int
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_count int := 0;
  v_day   date;
begin
  v_day := p_from + 1;
  while v_day < p_to loop
    if public._is_task_active_on(p_user_id, p_task_id, v_day) then
      v_count := v_count + 1;
    end if;
    v_day := v_day + 1;
  end loop;
  return v_count;
end;
$$;

-- ── RPC: set weekly template ──────────────────────────────────────────────────

create or replace function public.set_task_schedule(
  p_task_id     uuid,
  p_active_days int[]
) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  insert into public.user_task_schedule (user_id, task_id, active_days, updated_at)
  values (v_user_id, p_task_id, p_active_days, now())
  on conflict (user_id, task_id)
  do update set active_days = excluded.active_days, updated_at = now();
end;
$$;

-- ── RPC: set / clear a single-day override ───────────────────────────────────

create or replace function public.set_task_day_override(
  p_task_id   uuid,
  p_date      date,
  p_is_active boolean
) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  insert into public.user_task_day_override (user_id, task_id, override_date, is_active)
  values (v_user_id, p_task_id, p_date, p_is_active)
  on conflict (user_id, task_id, override_date)
  do update set is_active = excluded.is_active;
end;
$$;

-- ── Rewrite _recalc_summary: passive tasks don't block "day complete" ─────────

create or replace function public._recalc_summary(p_user_id uuid, p_date date)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_total            int;
  v_min              int;
  v_all_required_met boolean;
  v_day_completed    boolean;
  v_max              int;
begin
  select coalesce(sum(l.points_earned), 0) into v_total
  from public.task_logs l
  join public.tasks t on t.id = l.task_id
  where l.user_id = p_user_id and l.log_date = p_date and t.frequency = 'daily';

  select coalesce(min_daily_points, 100) into v_min
  from public.app_settings where id = 1;
  v_min := coalesce(v_min, 100);

  select not exists (
    select 1 from public.tasks t
    where t.is_active = true
      and t.frequency = 'daily'
      and (t.type = 'continuous' or (t.type = 'one-time' and t.recoverable = false))
      and public._is_task_active_on(p_user_id, t.id, p_date) = true
      and not exists (
        select 1 from public.task_logs l
        where l.user_id = p_user_id and l.log_date = p_date
          and l.task_id = t.id and l.is_completed = true
      )
  ) into v_all_required_met;

  v_day_completed := (v_total >= v_min) and v_all_required_met;

  insert into public.daily_summaries (user_id, summary_date, total_points, is_day_completed, updated_at)
  values (p_user_id, p_date, v_total, v_day_completed, now())
  on conflict (user_id, summary_date)
  do update set total_points     = excluded.total_points,
                is_day_completed = excluded.is_day_completed,
                updated_at       = now();

  select coalesce(max(total_points), 0) into v_max
  from public.daily_summaries where summary_date = p_date;

  update public.daily_summaries
    set is_leader  = (v_max > 0 and total_points = v_max and is_day_completed = true),
        updated_at = now()
  where summary_date = p_date;
end;
$$;

-- ── Rewrite _update_streak: passive days bridge gaps; only active-day misses
--   count toward the habit-break thresholds. ──────────────────────────────────

create or replace function public._update_streak(p_user_id uuid, p_task_id uuid, p_date date)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_existing       public.streaks%rowtype;
  v_last           date;
  v_current        int     := 0;
  v_longest        int     := 0;
  v_is_habit       boolean := false;
  v_habit_start    date    := null;
  v_gap            int;
  v_active_between int;
  v_misses30       int;
  v_consec         int;
  v_broken         boolean := false;
  v_i              int;
begin
  select * into v_existing from public.streaks
  where user_id = p_user_id and task_id = p_task_id;

  if found then
    v_last        := v_existing.last_completed_date;
    v_current     := coalesce(v_existing.current_streak, 0);
    v_longest     := coalesce(v_existing.longest_streak, 0);
    v_is_habit    := coalesce(v_existing.is_habit, false);
    v_habit_start := v_existing.habit_start_date;
  end if;

  if v_last is not null then
    v_gap := p_date - v_last;   -- signed

    if v_gap = 0 then
      return;  -- same-day re-trigger

    elsif v_gap < 0 then
      -- Retroactive catch-up log (date < last_completed_date). Don't change
      -- last_completed_date or current_streak — just update longest if needed.
      if v_current > v_longest then v_longest := v_current; end if;
      insert into public.streaks
        (user_id, task_id, current_streak, longest_streak, is_habit, habit_start_date, last_completed_date, updated_at)
      values
        (p_user_id, p_task_id, v_current, v_longest, v_is_habit, v_habit_start, v_last, now())
      on conflict (user_id, task_id)
      do update set longest_streak = excluded.longest_streak, updated_at = now();
      return;

    elsif v_gap = 1 then
      v_current := v_current + 1;

    else
      -- Gap > 1: bridge if all days in between were passive for this user.
      v_active_between := public._active_days_between(p_user_id, p_task_id, v_last, p_date);
      if v_active_between = 0 then
        v_current := v_current + 1;  -- all gap days were passive → streak continues
      else
        v_current := 1;              -- at least one active day was missed → reset
      end if;
    end if;
  else
    v_current := 1;
  end if;

  if v_current > v_longest then v_longest := v_current; end if;

  -- Promote to habit after 40-day streak
  if not v_is_habit and v_current >= 40 then
    v_is_habit    := true;
    v_habit_start := p_date;
    v_current     := 0;
  end if;

  -- Habit-break check: only active (non-passive) days count as misses.
  if v_is_habit then
    -- 6 active-day misses in last 30 days
    select count(*) into v_misses30
    from generate_series(1, 30) as g(i)
    where public._is_task_active_on(p_user_id, p_task_id, p_date - g.i) = true
      and (p_date - g.i) not in (
        select log_date from public.task_logs
        where user_id = p_user_id and task_id = p_task_id
          and is_completed = true and log_date >= p_date - 30
      );

    if v_misses30 >= 6 then
      v_broken := true;
    else
      -- 3 consecutive active-day misses
      v_consec := 0;
      for v_i in 1..30 loop
        if public._is_task_active_on(p_user_id, p_task_id, p_date - v_i) = true then
          if (p_date - v_i) not in (
            select log_date from public.task_logs
            where user_id = p_user_id and task_id = p_task_id
              and is_completed = true and log_date >= p_date - 30
          ) then
            v_consec := v_consec + 1;
            if v_consec >= 3 then v_broken := true; exit; end if;
          else
            exit;
          end if;
        end if;
      end loop;
    end if;

    if v_broken then
      v_is_habit    := false;
      v_habit_start := null;
      v_current     := 1;
    end if;
  end if;

  insert into public.streaks
    (user_id, task_id, current_streak, longest_streak, is_habit, habit_start_date, last_completed_date, updated_at)
  values
    (p_user_id, p_task_id, v_current, v_longest, v_is_habit, v_habit_start, p_date, now())
  on conflict (user_id, task_id)
  do update set current_streak      = excluded.current_streak,
                longest_streak      = excluded.longest_streak,
                is_habit            = excluded.is_habit,
                habit_start_date    = excluded.habit_start_date,
                last_completed_date = excluded.last_completed_date,
                updated_at          = now();
end;
$$;
