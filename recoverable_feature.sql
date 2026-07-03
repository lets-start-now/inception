-- ============================================================
-- HabitQuest — Recoverable / Non-recoverable one-time tasks
-- Run once in Supabase → SQL Editor.  (Run AFTER weekly_feature.sql.)
-- Safe to re-run.
-- ============================================================

-- New flag (meaningful for one-time tasks only).
--   recoverable = true  -> optional: skipping is fine if the points goal is met
--   recoverable = false -> required: must be completed for the day/week to finish
-- Default false = non-recoverable (blocking), per product decision.
alter table public.tasks
  add column if not exists recoverable boolean not null default false;

-- Daily summary recalc: a day is complete only when the points goal is met
-- AND every REQUIRED daily task is completed. Required = all continuous tasks
-- + any non-recoverable one-time task. Recoverable one-time tasks never block.
create or replace function public._recalc_summary(p_user_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_min   int;
  v_all_required_met boolean;
  v_day_completed boolean;
  v_max   int;
begin
  -- Daily total = points from DAILY-frequency tasks only
  select coalesce(sum(l.points_earned), 0) into v_total
  from public.task_logs l
  join public.tasks t on t.id = l.task_id
  where l.user_id = p_user_id and l.log_date = p_date and t.frequency = 'daily';

  select coalesce(min_daily_points, 100) into v_min
  from public.app_settings where id = 1;
  v_min := coalesce(v_min, 100);

  -- Every REQUIRED active daily task must be completed today.
  select not exists (
    select 1 from public.tasks t
    where t.is_active = true and t.frequency = 'daily'
      and (t.type = 'continuous' or (t.type = 'one-time' and t.recoverable = false))
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

  -- Leader of the day = the #1-ranked user for the date, but ONLY if they
  -- also completed the day. If the top scorer hasn't finished the day, there
  -- is no leader. Ties at the top who all completed each get the flag.
  select coalesce(max(total_points), 0) into v_max
  from public.daily_summaries where summary_date = p_date;

  update public.daily_summaries
    set is_leader = (v_max > 0 and total_points = v_max and is_day_completed = true),
        updated_at = now()
    where summary_date = p_date;
end;
$$;
