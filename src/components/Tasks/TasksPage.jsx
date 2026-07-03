import { useState } from 'react'
import { CalendarDays, CalendarRange, CheckCircle2, Inbox, CheckCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { logTaskAction, undoTaskAction } from '../../lib/taskLogic'
import { today } from '../../lib/dateUtils'
import TaskCard from './TaskCard'

const freqOf = (t) => (t.frequency === 'weekly' ? 'weekly' : 'daily')

export default function TasksPage() {
  const { profile } = useAuth()
  const {
    tasks, weekLogs, logMap, totalPoints, minPoints, dayCompleted, minWeeklyPoints,
    syncToday, setWeekLogs, setTodaySummary,
  } = useApp()
  const [filter, setFilter] = useState('all')   // 'all' | 'pending' | 'done'
  const [toast,  setToast]  = useState(null)

  const todayStr = today()

  // ── Week aggregates (for weekly tasks) ───────────────────────────
  function weekAgg(taskId) {
    let count = 0, points = 0
    for (const l of weekLogs) {
      if (l.task_id === taskId) { count += l.action_count; points += l.points_earned }
    }
    return { count, points }
  }
  // A weekly task's "period log" mirrors the shape TaskCard expects, but
  // aggregated across the whole Mon–Sun week.
  function weekPeriodLog(task) {
    const { count, points } = weekAgg(task.id)
    return {
      action_count:  count,
      points_earned: points,
      is_completed:  task.type === 'one-time' ? count >= 1 : count >= task.daily_threshold,
    }
  }
  // The log shown on a card: today's row for daily, week aggregate for weekly.
  const periodLog = (task) => (freqOf(task) === 'weekly' ? weekPeriodLog(task) : logMap[task.id])

  // ── Optimistic local updates (canonical store = weekLogs) ────────
  function upsertTodayRow(prev, task, delta) {
    const idx = prev.findIndex((l) => l.task_id === task.id && l.log_date === todayStr)
    const cur = idx >= 0
      ? prev[idx]
      : { task_id: task.id, log_date: todayStr, action_count: 0, points_earned: 0, is_completed: false }
    const newCount  = Math.max(0, cur.action_count + delta)
    const newPoints = Math.max(0, cur.points_earned + delta * task.points_per_action)
    const isCompleted = task.type === 'one-time' ? delta > 0 : newCount >= task.daily_threshold
    const updated = { ...cur, action_count: newCount, points_earned: newPoints, is_completed: isCompleted }
    if (idx >= 0) { const copy = [...prev]; copy[idx] = updated; return copy }
    return [...prev, updated]
  }

  function applyOptimistic(task, delta) {
    setWeekLogs((prev) => upsertTodayRow(prev, task, delta))
    // Only daily tasks feed the daily points total.
    if (freqOf(task) === 'daily') {
      setTodaySummary((s) => ({
        ...(s ?? {}),
        total_points: Math.max(0, (s?.total_points ?? 0) + delta * task.points_per_action),
      }))
    }
  }

  function applyServerState(task, log, summary) {
    if (log && log.task_id) {
      setWeekLogs((prev) => {
        const idx = prev.findIndex((l) => l.task_id === log.task_id && l.log_date === log.log_date)
        if (idx >= 0) { const copy = [...prev]; copy[idx] = log; return copy }
        return [...prev, log]
      })
    }
    if (freqOf(task) === 'daily' && summary) setTodaySummary(summary)
  }

  // ── Handlers ─────────────────────────────────────────────────────
  async function handleLog(task) {
    const freq = freqOf(task)
    if (task.type === 'one-time') {
      const done = freq === 'weekly' ? weekAgg(task.id).count >= 1 : logMap[task.id]?.is_completed
      if (done) {
        showToast(`Already completed ${freq === 'weekly' ? 'this week' : 'today'}!`, 'warn')
        return
      }
    }

    applyOptimistic(task, +1)
    showToast(`+${task.points_per_action} pts earned!`, 'success')
    const { error, blocked, log, summary } = await logTaskAction(profile.id, task, todayStr)
    if (blocked) {
      showToast('Already completed!', 'warn')
      syncToday()
    } else if (error) {
      console.error('logTaskAction failed:', error)
      showToast(`Save failed: ${error.message ?? 'unknown error'}`, 'error')
      syncToday()
    } else {
      applyServerState(task, log, summary)
    }
  }

  async function handleUndo(task) {
    // Undo only removes an action logged *today*.
    const todayRow = weekLogs.find((l) => l.task_id === task.id && l.log_date === todayStr)
    if (!todayRow || todayRow.action_count === 0) {
      showToast(freqOf(task) === 'weekly' ? 'Nothing logged today to undo' : 'Nothing to undo', 'warn')
      return
    }

    applyOptimistic(task, -1)
    const { error, log, summary } = await undoTaskAction(profile.id, task, todayStr)
    if (error) {
      console.error('undoTaskAction failed:', error)
      showToast(`Save failed: ${error.message ?? 'unknown error'}`, 'error')
      syncToday()
    } else {
      showToast('Action removed.', 'warn')
      applyServerState(task, log, summary)
    }
  }

  function showToast(msg, type) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Split tasks + filter ─────────────────────────────────────────
  const dailyTasks  = tasks.filter((t) => freqOf(t) === 'daily')
  const weeklyTasks = tasks.filter((t) => freqOf(t) === 'weekly')

  function applyFilter(list) {
    return list.filter((t) => {
      const done = periodLog(t)?.is_completed
      if (filter === 'done')    return done
      if (filter === 'pending') return !done
      return true
    })
  }
  const dailyFiltered  = applyFilter(dailyTasks)
  const weeklyFiltered = applyFilter(weeklyTasks)

  const dailyDone  = dailyTasks.filter((t) => logMap[t.id]?.is_completed).length
  const weeklyDone = weeklyTasks.filter((t) => weekPeriodLog(t).is_completed).length

  const weeklyTaskIds = new Set(weeklyTasks.map((t) => t.id))
  const weeklyTotal   = weekLogs
    .filter((l) => weeklyTaskIds.has(l.task_id))
    .reduce((s, l) => s + l.points_earned, 0)
  // Mirror the daily rule: complete only when the points goal is met AND every
  // REQUIRED weekly task is done. Required = all continuous tasks + any
  // non-recoverable one-time task. Recoverable one-time tasks never block.
  const allWeeklyRequiredMet = weeklyTasks
    .filter((t) => t.type === 'continuous' || (t.type === 'one-time' && t.recoverable === false))
    .every((t) => weekPeriodLog(t).is_completed)
  const weekCompleted = weeklyTotal >= minWeeklyPoints && allWeeklyRequiredMet

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-ink-400 text-sm mt-1">Track your daily and weekly goals</p>
      </div>

      {/* Filter tabs */}
      <div className="segmented">
        {['all', 'pending', 'done'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`segmented-item capitalize ${filter === f ? 'segmented-item-active' : ''}`}
          >
            {f}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ── DAILY ────────────────────────────────────────────── */}
          {dailyTasks.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={CalendarDays}
                title="Daily"
                done={dailyDone}
                total={dailyTasks.length}
                complete={dayCompleted}
                completeLabel="Day complete"
              />
              <ProgressBar
                label={`Daily goal: ${minPoints} pts`}
                value={totalPoints}
                max={minPoints}
                complete={dayCompleted}
              />
              {dailyFiltered.length === 0 ? (
                <EmptySection filter={filter} />
              ) : (
                dailyFiltered.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    log={logMap[task.id]}
                    onLog={handleLog}
                    onUndo={handleUndo}
                  />
                ))
              )}
            </section>
          )}

          {/* ── WEEKLY ───────────────────────────────────────────── */}
          {weeklyTasks.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={CalendarRange}
                title="Weekly"
                done={weeklyDone}
                total={weeklyTasks.length}
                complete={weekCompleted}
                completeLabel="Week complete"
              />
              <ProgressBar
                label={`Weekly goal: ${minWeeklyPoints} pts`}
                value={weeklyTotal}
                max={minWeeklyPoints}
                complete={weekCompleted}
              />
              {weeklyFiltered.length === 0 ? (
                <EmptySection filter={filter} />
              ) : (
                weeklyFiltered.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    log={weekPeriodLog(task)}
                    onLog={handleLog}
                    onUndo={handleUndo}
                  />
                ))
              )}
            </section>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm shadow-elevated animate-slide-up border ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : toast.type === 'warn'  ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, done, total, complete, completeLabel }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-semibold text-ink-100 flex items-center gap-2.5">
        <Icon size={18} className="text-ink-400" />
        {title}
        <span className="text-ink-500 font-normal text-sm tabular-nums">{done}/{total}</span>
      </h2>
      {complete && (
        <span className="badge-green px-2.5 py-1 h-auto">
          <CheckCircle2 size={13} /> {completeLabel}
        </span>
      )}
    </div>
  )
}

function ProgressBar({ label, value, max, complete }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100))
  return (
    <div className="card py-3.5">
      <div className="flex justify-between text-xs mb-2">
        <span className="text-ink-400 font-medium">{label}</span>
        <span className="text-ink-300 tabular-nums">{value} pts · {pct}%</span>
      </div>
      <div className="track h-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${complete ? 'bg-emerald-500' : 'bg-accent-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function EmptySection({ filter }) {
  return (
    <div className="surface-2 flex flex-col items-center text-center text-ink-500 py-8 px-4">
      <CheckCheck size={22} className="text-ink-600 mb-2" />
      <p className="text-sm">No {filter === 'all' ? '' : filter + ' '}tasks here.</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-ink-800 flex items-center justify-center mb-4">
        <Inbox size={26} className="text-ink-500" />
      </div>
      <p className="font-semibold text-ink-200">No tasks yet</p>
      <p className="text-ink-500 text-sm mt-1">Ask an admin to create some tasks.</p>
    </div>
  )
}
