-- ============================================================
-- HabitQuest — server-side RPC functions
-- Collapses the per-tap "log / undo" work into ONE round-trip.
--
-- Run this whole file once in:  Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (every function uses CREATE OR REPLACE).
-- ============================================================

-- ── Helper: recalc a user's daily summary + refresh leader flags ──
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
  select coalesce(sum(points_earned), 0) into v_total
  from public.task_logs
  where user_id = p_user_id and log_date = p_date;

  select coalesce(min_daily_points, 100) into v_min
  from public.app_settings where id = 1;
  v_min := coalesce(v_min, 100);

  -- true when there is no active continuous task left uncompleted
  select not exists (
    select 1 from public.tasks t
    where t.type = 'continuous' and t.is_active = true
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

-- ── Helper: update streak / habit state after a completion ────────
create or replace function public._update_streak(p_user_id uuid, p_task_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.streaks%rowtype;
  v_last date;
  v_current int := 0;
  v_longest int := 0;
  v_is_habit boolean := false;
  v_habit_start date := null;
  v_gap int;
  v_misses30 int;
  v_consec int;
  v_broken boolean := false;
  v_just_promoted boolean := false;
  v_i int;
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
    v_gap := abs(p_date - v_last);
    if v_gap = 1 then
      v_current := v_current + 1;
    elsif v_gap = 0 then
      return;  -- same day re-trigger, no change
    else
      v_current := 1;
    end if;
  else
    v_current := 1;
  end if;

  if v_current > v_longest then
    v_longest := v_current;
  end if;

  -- Promote to habit after 40-day streak
  if not v_is_habit and v_current >= 40 then
    v_is_habit      := true;
    v_habit_start   := p_date;
    v_current       := 0;
    v_just_promoted := true;
  end if;

  -- Habit break check: 6 misses in last 30 days OR 3 consecutive misses.
  -- Skip on the same completion that just earned the habit — it was literally
  -- just promoted, so don't immediately re-judge it as broken.
  if v_is_habit and not v_just_promoted then
    select count(*) into v_misses30
    from generate_series(1, 30) as g(i)
    where (p_date - g.i) not in (
      select log_date from public.task_logs
      where user_id = p_user_id and task_id = p_task_id
        and is_completed = true and log_date >= p_date - 30
    );

    if v_misses30 >= 6 then
      v_broken := true;
    else
      v_consec := 0;
      for v_i in 1..30 loop
        if (p_date - v_i) not in (
          select log_date from public.task_logs
          where user_id = p_user_id and task_id = p_task_id
            and is_completed = true and log_date >= p_date - 30
        ) then
          v_consec := v_consec + 1;
          if v_consec >= 3 then
            v_broken := true;
            exit;
          end if;
        else
          exit;
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

-- ── Public RPC: log one action for a task ─────────────────────────
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

  -- Block one-time tasks already completed
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

-- ── Public RPC: undo one action for a task ────────────────────────
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

  -- Nothing to undo
  if not found or v_prev.action_count = 0 then
    select * into v_summary from public.daily_summaries
      where user_id = v_user_id and summary_date = p_date;
    return jsonb_build_object('log', to_jsonb(v_prev), 'summary', to_jsonb(v_summary));
  end if;

  v_count  := v_prev.action_count - 1;
  v_points := greatest(0, v_prev.points_earned - v_task.points_per_action);
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

-- ── Allow logged-in users to call the two public RPCs ─────────────
grant execute on function public.log_task_action(uuid, date)  to authenticated;
grant execute on function public.undo_task_action(uuid, date) to authenticated;
