-- ============================================================
-- HabitQuest — Daily / Weekly tasks feature
-- Run this whole file once in:  Supabase Dashboard → SQL Editor
-- Safe to re-run.
-- ============================================================

-- ── 1. New columns ───────────────────────────────────────────────
alter table public.tasks
  add column if not exists frequency text not null default 'daily'
  check (frequency in ('daily', 'weekly'));

alter table public.app_settings
  add column if not exists min_weekly_points integer not null default 300;

-- For a weekly task, daily_threshold is reused as the WEEKLY threshold
-- (number of actions needed across the Mon–Sun week to complete it).

-- ── 2. Daily summary recalc — DAILY tasks only ───────────────────
-- Weekly-task points/completion must NOT affect the daily total,
-- the "day complete" flag, or the leaderboard.
create or replace function public._recalc_summary(p_user_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_min   int;
  v_all_continuous_met boolean;
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

  -- All active DAILY continuous tasks completed today?
  select not exists (
    select 1 from public.tasks t
    where t.type = 'continuous' and t.is_active = true and t.frequency = 'daily'
      and not exists (
        select 1 from public.task_logs l
        where l.user_id = p_user_id and l.log_date = p_date
          and l.task_id = t.id and l.is_completed = true
      )
  ) into v_all_continuous_met;

  v_day_completed := (v_total >= v_min) and v_all_continuous_met;

  insert into public.daily_summaries (user_id, summary_date, total_points, is_day_completed, updated_at)
  values (p_user_id, p_date, v_total, v_day_completed, now())
  on conflict (user_id, summary_date)
  do update set total_points     = excluded.total_points,
                is_day_completed = excluded.is_day_completed,
                updated_at       = now();

  -- Refresh leader flag across ALL users for this date (handles ties)
  select max(total_points) into v_max
  from public.daily_summaries where summary_date = p_date;

  if v_max is not null and v_max > 0 then
    update public.daily_summaries
      set is_leader = (total_points = v_max), updated_at = now()
      where summary_date = p_date;
  else
    update public.daily_summaries
      set is_leader = false, updated_at = now()
      where summary_date = p_date and is_leader = true;
  end if;
end;
$$;

-- ── 3. log_task_action — handles daily AND weekly ────────────────
create or replace function public.log_task_action(p_task_id uuid, p_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task    public.tasks%rowtype;
  v_prev    public.task_logs%rowtype;
  v_prev_completed boolean := false;
  v_count   int := 0;
  v_points  int := 0;
  v_completed boolean;
  v_log     public.task_logs%rowtype;
  v_summary public.daily_summaries%rowtype;
  v_week_start date;
  v_week_end   date;
  v_week_count int;
  v_week_points int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_task from public.tasks where id = p_task_id and is_active = true;
  if not found then
    raise exception 'Task not found or inactive';
  end if;

  select * into v_prev from public.task_logs
    where user_id = v_user_id and task_id = p_task_id and log_date = p_date;
  if found then
    v_count          := v_prev.action_count;
    v_points         := v_prev.points_earned;
    v_prev_completed := v_prev.is_completed;
  end if;

  -- ===================== WEEKLY =====================
  if v_task.frequency = 'weekly' then
    v_week_start := date_trunc('week', p_date)::date;   -- Monday
    v_week_end   := v_week_start + 6;

    select coalesce(sum(action_count), 0) into v_week_count
    from public.task_logs
    where user_id = v_user_id and task_id = p_task_id
      and log_date between v_week_start and v_week_end;

    -- one-time weekly: block if already done this week
    if v_task.type = 'one-time' and v_week_count >= 1 then
      return jsonb_build_object('blocked', true);
    end if;

    v_count      := v_count + 1;
    v_points     := v_points + v_task.points_per_action;
    v_week_count := v_week_count + 1;
    if v_task.type = 'one-time' then
      v_completed := true;
    else
      v_completed := v_week_count >= v_task.daily_threshold;
    end if;

    insert into public.task_logs
      (user_id, task_id, log_date, action_count, points_earned, is_completed, updated_at)
    values
      (v_user_id, p_task_id, p_date, v_count, v_points, v_completed, now())
    on conflict (user_id, task_id, log_date)
    do update set action_count  = excluded.action_count,
                  points_earned = excluded.points_earned,
                  is_completed  = excluded.is_completed,
                  updated_at    = now()
    returning * into v_log;

    select coalesce(sum(points_earned), 0) into v_week_points
    from public.task_logs
    where user_id = v_user_id and task_id = p_task_id
      and log_date between v_week_start and v_week_end;

    return jsonb_build_object(
      'blocked', false,
      'log',     to_jsonb(v_log),
      'week',    jsonb_build_object('count', v_week_count, 'points', v_week_points, 'completed', v_completed)
    );
  end if;

  -- ===================== DAILY =====================
  if v_task.type = 'one-time' and v_prev_completed then
    return jsonb_build_object('blocked', true);
  end if;

  v_count  := v_count + 1;
  v_points := v_points + v_task.points_per_action;
  if v_task.type = 'one-time' then
    v_completed := true;
  else
    v_completed := v_count >= v_task.daily_threshold;
  end if;

  insert into public.task_logs
    (user_id, task_id, log_date, action_count, points_earned, is_completed, updated_at)
  values
    (v_user_id, p_task_id, p_date, v_count, v_points, v_completed, now())
  on conflict (user_id, task_id, log_date)
  do update set action_count  = excluded.action_count,
                points_earned = excluded.points_earned,
                is_completed  = excluded.is_completed,
                updated_at    = now()
  returning * into v_log;

  if v_completed and not v_prev_completed then
    perform public._update_streak(v_user_id, p_task_id, p_date);
  end if;

  perform public._recalc_summary(v_user_id, p_date);

  select * into v_summary from public.daily_summaries
    where user_id = v_user_id and summary_date = p_date;

  return jsonb_build_object(
    'blocked', false,
    'log',     to_jsonb(v_log),
    'summary', to_jsonb(v_summary)
  );
end;
$$;

-- ── 4. undo_task_action — handles daily AND weekly ───────────────
create or replace function public.undo_task_action(p_task_id uuid, p_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task    public.tasks%rowtype;
  v_prev    public.task_logs%rowtype;
  v_count   int;
  v_points  int;
  v_completed boolean;
  v_log     public.task_logs%rowtype;
  v_summary public.daily_summaries%rowtype;
  v_week_start date;
  v_week_end   date;
  v_week_count int;
  v_week_points int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_prev from public.task_logs
    where user_id = v_user_id and task_id = p_task_id and log_date = p_date;

  -- Nothing logged today to undo
  if not found or v_prev.action_count = 0 then
    if v_task.frequency = 'weekly' then
      v_week_start := date_trunc('week', p_date)::date;
      v_week_end   := v_week_start + 6;
      select coalesce(sum(action_count), 0), coalesce(sum(points_earned), 0)
        into v_week_count, v_week_points
      from public.task_logs
      where user_id = v_user_id and task_id = p_task_id
        and log_date between v_week_start and v_week_end;
      return jsonb_build_object(
        'log',  to_jsonb(v_prev),
        'week', jsonb_build_object(
          'count', v_week_count, 'points', v_week_points,
          'completed', case when v_task.type = 'one-time'
                            then v_week_count >= 1
                            else v_week_count >= v_task.daily_threshold end)
      );
    else
      select * into v_summary from public.daily_summaries
        where user_id = v_user_id and summary_date = p_date;
      return jsonb_build_object('log', to_jsonb(v_prev), 'summary', to_jsonb(v_summary));
    end if;
  end if;

  v_count  := v_prev.action_count - 1;
  v_points := greatest(0, v_prev.points_earned - v_task.points_per_action);

  -- ===================== WEEKLY =====================
  if v_task.frequency = 'weekly' then
    v_week_start := date_trunc('week', p_date)::date;
    v_week_end   := v_week_start + 6;

    select coalesce(sum(action_count), 0) into v_week_count
    from public.task_logs
    where user_id = v_user_id and task_id = p_task_id
      and log_date between v_week_start and v_week_end;
    v_week_count := v_week_count - 1;

    if v_task.type = 'one-time' then
      v_completed := v_week_count >= 1;
    else
      v_completed := v_week_count >= v_task.daily_threshold;
    end if;

    update public.task_logs
      set action_count  = v_count,
          points_earned = v_points,
          is_completed  = v_completed,
          updated_at    = now()
      where id = v_prev.id
      returning * into v_log;

    select coalesce(sum(points_earned), 0) into v_week_points
    from public.task_logs
    where user_id = v_user_id and task_id = p_task_id
      and log_date between v_week_start and v_week_end;

    return jsonb_build_object(
      'log',  to_jsonb(v_log),
      'week', jsonb_build_object('count', v_week_count, 'points', v_week_points, 'completed', v_completed)
    );
  end if;

  -- ===================== DAILY =====================
  if v_task.type = 'one-time' then
    v_completed := false;
  else
    v_completed := v_count >= v_task.daily_threshold;
  end if;

  update public.task_logs
    set action_count  = v_count,
        points_earned = v_points,
        is_completed  = v_completed,
        updated_at    = now()
    where id = v_prev.id
    returning * into v_log;

  perform public._recalc_summary(v_user_id, p_date);

  select * into v_summary from public.daily_summaries
    where user_id = v_user_id and summary_date = p_date;

  return jsonb_build_object(
    'log',     to_jsonb(v_log),
    'summary', to_jsonb(v_summary)
  );
end;
$$;

-- grants unchanged (functions keep the same signatures)
grant execute on function public.log_task_action(uuid, date)  to authenticated;
grant execute on function public.undo_task_action(uuid, date) to authenticated;
