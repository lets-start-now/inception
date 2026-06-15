import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { fetchDailySummary } from '../lib/taskLogic'
import { today, weekStart } from '../lib/dateUtils'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { user } = useAuth()
  const [tasks,         setTasks]         = useState([])
  const [weekLogs,      setWeekLogs]      = useState([])  // task_logs from this week's Monday → today
  const [todaySummary,  setTodaySummary]  = useState(null)
  const [minPoints,     setMinPoints]     = useState(100)
  const [minWeeklyPoints, setMinWeeklyPoints] = useState(300)
  const [loading,       setLoading]       = useState(false)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = weekStart()
    const [
      { data: taskData },
      { data: weekLogData },
      summaryData,
      { data: settingsData },
    ] = await Promise.all([
      supabase.from('tasks').select('*').eq('is_active', true).order('created_at'),
      supabase.from('task_logs').select('*').eq('user_id', user.id).gte('log_date', since),
      fetchDailySummary(user.id, today()),
      supabase.from('app_settings').select('*').eq('id', 1).single(),
    ])
    setTasks(taskData ?? [])
    setWeekLogs(weekLogData ?? [])
    setTodaySummary(summaryData)
    setMinPoints(settingsData?.min_daily_points ?? 100)
    setMinWeeklyPoints(settingsData?.min_weekly_points ?? 300)
    setLoading(false)
  }, [user?.id])

  // Lightweight reconcile after a log/undo: re-pull this week's logs + summary.
  const syncToday = useCallback(async () => {
    if (!user) return
    const since = weekStart()
    const [{ data: weekLogData }, summaryData] = await Promise.all([
      supabase.from('task_logs').select('*').eq('user_id', user.id).gte('log_date', since),
      fetchDailySummary(user.id, today()),
    ])
    setWeekLogs(weekLogData ?? [])
    setTodaySummary(summaryData)
  }, [user?.id])

  useEffect(() => { refresh() }, [refresh])

  // Derive today's logs + lookup from the week's logs
  const todayStr = today()
  const todayLogs = weekLogs.filter((l) => l.log_date === todayStr)
  const logMap = todayLogs.reduce((m, l) => { m[l.task_id] = l; return m }, {})

  const totalPoints = todaySummary?.total_points ?? 0
  const dayCompleted = todaySummary?.is_day_completed ?? false

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
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
