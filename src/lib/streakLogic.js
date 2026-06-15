import { supabase } from './supabase'
import { today, daysBetween, toDateStr } from './dateUtils'
import { subDays } from 'date-fns'

const HABIT_THRESHOLD        = 40  // days to become a habit
const HABIT_BREAK_CONSEC     = 3   // consecutive misses to break habit
const HABIT_BREAK_IN_30      = 6   // misses in last 30 days to break habit

/**
 * Called after a task is marked completed for the day.
 * Upserts the streak row and checks habit promotion.
 */
export async function updateStreakAfterCompletion(userId, taskId, date = today()) {
  // Get or create streak row
  const { data: existing } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .maybeSingle()

  const last = existing?.last_completed_date
  let currentStreak = existing?.current_streak ?? 0
  let longestStreak = existing?.longest_streak ?? 0
  let isHabit       = existing?.is_habit ?? false
  let habitStart    = existing?.habit_start_date ?? null

  if (last) {
    const gap = daysBetween(date, last)
    if (gap === 1) {
      currentStreak += 1
    } else if (gap === 0) {
      // Same day re-trigger — no change
      return
    } else {
      // Gap > 1: streak broken before this completion
      currentStreak = 1
    }
  } else {
    currentStreak = 1
  }

  if (currentStreak > longestStreak) longestStreak = currentStreak

  // Promote to habit
  if (!isHabit && currentStreak >= HABIT_THRESHOLD) {
    isHabit    = true
    habitStart = date
    currentStreak = 0  // streak resets when habit is earned
  }

  // Check habit break conditions
  if (isHabit) {
    const broken = await isHabitBroken(userId, taskId, date)
    if (broken) {
      isHabit       = false
      habitStart    = null
      currentStreak = 1  // restart streak from today
    }
  }

  await supabase.from('streaks').upsert(
    {
      user_id:             userId,
      task_id:             taskId,
      current_streak:      currentStreak,
      longest_streak:      longestStreak,
      is_habit:            isHabit,
      habit_start_date:    habitStart,
      last_completed_date: date,
      updated_at:          new Date().toISOString(),
    },
    { onConflict: 'user_id,task_id' }
  )
}

/**
 * Check if a habit should be broken.
 * Broken if: 3 consecutive missed days OR 6 misses in last 30 days.
 */
async function isHabitBroken(userId, taskId, currentDate) {
  // Get task_logs for last 30 days
  const since = toDateStr(subDays(new Date(currentDate), 30))

  const { data: logs } = await supabase
    .from('task_logs')
    .select('log_date, is_completed')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .gte('log_date', since)
    .order('log_date', { ascending: false })

  const completedSet = new Set((logs ?? []).filter((l) => l.is_completed).map((l) => l.log_date))

  // Build last-30-day array (most recent first, exclude today)
  const days30 = []
  for (let i = 1; i <= 30; i++) {
    days30.push(toDateStr(subDays(new Date(currentDate), i)))
  }

  // Count total misses in 30 days
  const misses30 = days30.filter((d) => !completedSet.has(d)).length

  if (misses30 >= HABIT_BREAK_IN_30) return true

  // Count consecutive misses (from most recent backward)
  let consecutive = 0
  for (const d of days30) {
    if (!completedSet.has(d)) {
      consecutive++
      if (consecutive >= HABIT_BREAK_CONSEC) return true
    } else {
      break
    }
  }

  return false
}

/** Fetch all streaks for a user */
export async function fetchUserStreaks(userId) {
  const { data } = await supabase
    .from('streaks')
    .select('*, tasks(title, type)')
    .eq('user_id', userId)
  return data ?? []
}
