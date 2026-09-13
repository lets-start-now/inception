import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { fetchDailySummary } from '../lib/taskLogic'
import { today, yesterday, weekStart, daysBetween } from '../lib/dateUtils'

const AppContext = createContext(null)

// ISO weekday index matching our SQL convention: 0=Mon … 6=Sun
function weekdayOf(dateStr) {
  return (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7
}

export function AppProvider({ children }) {
  const { user } = useAuth()
  const [tasks,         setTasks]         = useState([])
  const [weekLogs,      setWeekLogs]      = useState([])
  const [todaySummary,  setTodaySummary]  = useState(null)
  const [minPoints,     setMinPoints]     = useState(100)
  const [minWeeklyPoints, setMinWeeklyPoints] = useState(300)
  const [schedules,     setSchedules]     = useState([])  // user_task_schedule rows
  const [overrides,     setOverrides]     = useState([])  // user_task_day_override rows
  const [streaks,       setStreaks]       = useState([])  // streaks rows (habits only needed)
  const [loading,       setLoading]       = useState(false)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const todayStr     = today()
    const yesterdayStr = yesterday()
    const weekStartStr = weekStart()
    // Ensure yesterday is always included even when it falls before Monday
    const since = yesterdayStr < weekStartStr ? yesterdayStr : weekStartStr

    const [
      { data: taskData },
      { data: weekLogData },
      summaryData,
      { data: settingsData },
      { data: scheduleData },
      { data: overrideData },
      { data: streakData },
    ] = await Promise.all([
      supabase.from('tasks').select('*').eq('is_active', true).order('created_at'),
      supabase.from('task_logs').select('*').eq('user_id', user.id).gte('log_date', since),
      fetchDailySummary(user.id, todayStr),
      supabase.from('app_settings').select('*').eq('id', 1).single(),
      supabase.from('user_task_schedule').select('task_id, active_days').eq('user_id', user.id),
      supabase.from('user_task_day_override')
        .select('task_id, override_date, is_active')
        .eq('user_id', user.id)
        .gte('override_date', yesterdayStr),
      supabase.from('streaks')
        .select('task_id, is_habit, last_completed_date')
        .eq('user_id', user.id),
    ])

    setTasks(taskData ?? [])
    setWeekLogs(weekLogData ?? [])
    setTodaySummary(summaryData)
    setMinPoints(settingsData?.min_daily_points ?? 100)
    setMinWeeklyPoints(settingsData?.min_weekly_points ?? 300)
    setSchedules(scheduleData ?? [])
    setOverrides(overrideData ?? [])
    setStreaks(streakData ?? [])
    setLoading(false)
  }, [user?.id])

  const syncToday = useCallback(async () => {
    if (!user) return
    const todayStr     = today()
    const yesterdayStr = yesterday()
    const weekStartStr = weekStart()
    const since = yesterdayStr < weekStartStr ? yesterdayStr : weekStartStr

    const [
      { data: weekLogData },
      summaryData,
      { data: overrideData },
    ] = await Promise.all([
      supabase.from('task_logs').select('*').eq('user_id', user.id).gte('log_date', since),
      fetchDailySummary(user.id, todayStr),
      supabase.from('user_task_day_override')
        .select('task_id, override_date, is_active')
        .eq('user_id', user.id)
        .gte('override_date', yesterdayStr),
    ])

    setWeekLogs(weekLogData ?? [])
    setTodaySummary(summaryData)
    setOverrides(overrideData ?? [])
  }, [user?.id])

  useEffect(() => { refresh() }, [refresh])

  // ── Derived: today's logs ─────────────────────────────────────────────────
  const todayStr  = today()
  const todayLogs = weekLogs.filter((l) => l.log_date === todayStr)
  const logMap    = todayLogs.reduce((m, l) => { m[l.task_id] = l; return m }, {})

  const totalPoints = todaySummary?.total_points  ?? 0
  const dayCompleted = todaySummary?.is_day_completed ?? false

  // ── Schedule helpers ──────────────────────────────────────────────────────

  function isTaskActiveOn(taskId, dateStr) {
    const ov = overrides.find((o) => o.task_id === taskId && o.override_date === dateStr)
    if (ov) return ov.is_active
    const sched = schedules.find((s) => s.task_id === taskId)
    if (!sched) return true  // no template → active every day
    return sched.active_days.includes(weekdayOf(dateStr))
  }

  function getSchedule(taskId) {
    return schedules.find((s) => s.task_id === taskId)?.active_days ?? [0,1,2,3,4,5,6]
  }

  async function setTaskSchedule(taskId, activeDays) {
    // Optimistic
    setSchedules((prev) => {
      const idx = prev.findIndex((s) => s.task_id === taskId)
      const row = { task_id: taskId, active_days: activeDays }
      if (idx >= 0) { const c = [...prev]; c[idx] = row; return c }
      return [...prev, row]
    })
    await supabase.rpc('set_task_schedule', { p_task_id: taskId, p_active_days: activeDays })
  }

  async function overrideTaskToday(taskId, isActive) {
    const dateStr = today()
    setOverrides((prev) => {
      const idx = prev.findIndex((o) => o.task_id === taskId && o.override_date === dateStr)
      const row = { task_id: taskId, override_date: dateStr, is_active: isActive }
      if (idx >= 0) { const c = [...prev]; c[idx] = row; return c }
      return [...prev, row]
    })
    await supabase.rpc('set_task_day_override', {
      p_task_id:   taskId,
      p_date:      dateStr,
      p_is_active: isActive,
    })
  }

  // ── Habit risk ────────────────────────────────────────────────────────────
  // Returns true when skipping today would trigger (or has already triggered)
  // the consecutive-miss habit-break threshold (3 active-day misses in a row).

  function isHabitAtRisk(taskId) {
    const s = streaks.find((r) => r.task_id === taskId)
    if (!s?.is_habit) return false
    if (!s.last_completed_date) return true
    // daysBetween is absolute; today > last_completed means days-ago count
    return daysBetween(today(), s.last_completed_date) >= 3
  }

  return (
    <AppContext.Provider value={{
      tasks,
      weekLogs,
      todayLogs,
      todaySummary,
      logMap,
      minPoints,
      minWeeklyPoints,
      totalPoints,
      dayCompleted,
      loading,
      refresh,
      syncToday,
      setTasks,
      setWeekLogs,
      setTodaySummary,
      // schedule
      isTaskActiveOn,
      getSchedule,
      setTaskSchedule,
      overrideTaskToday,
      // habit risk
      isHabitAtRisk,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
