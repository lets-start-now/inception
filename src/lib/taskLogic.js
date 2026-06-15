import { supabase } from './supabase'
import { today } from './dateUtils'

/**
 * Log one action for a task — a single server-side RPC round-trip.
 * The log_task_action() Postgres function does the upsert, daily-summary
 * recalc, leaderboard refresh and streak update atomically.
 * Returns { error, blocked, log, summary }.
 */
export async function logTaskAction(userId, task, date = today()) {
  const { data, error } = await supabase.rpc('log_task_action', {
    p_task_id: task.id,
    p_date:    date,
  })
  if (error) return { error }
  if (data?.blocked) return { blocked: true, error: null }
  return { error: null, blocked: false, log: data?.log, summary: data?.summary, week: data?.week }
}

/**
 * Undo one action for a task — a single server-side RPC round-trip.
 * Returns { error, log, summary }.
 */
export async function undoTaskAction(userId, task, date = today()) {
  const { data, error } = await supabase.rpc('undo_task_action', {
    p_task_id: task.id,
    p_date:    date,
  })
  if (error) return { error }
  return { error: null, log: data?.log, summary: data?.summary, week: data?.week }
}

/** Fetch task logs for a user on a given date */
export async function fetchTodayLogs(userId, date = today()) {
  const { data, error } = await supabase
    .from('task_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', date)
  return { data: data ?? [], error }
}

/** Fetch daily summary for a user on a given date */
export async function fetchDailySummary(userId, date = today()) {
  const { data } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('summary_date', date)
    .maybeSingle()
  return data
}

/** Fetch the leader profile for a given date */
export async function fetchLeaderForDate(date) {
  const { data } = await supabase
    .from('daily_summaries')
    .select('*, profiles(username)')
    .eq('summary_date', date)
    .eq('is_leader', true)
    .order('total_points', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
