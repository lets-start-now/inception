import { useState } from 'react'
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
  // continuous weekly task has reached its weekly threshold. Hitting the points
  // number alone (without finishing the task thresholds) is not "complete".
  const allWeeklyContinuousMet = weeklyTasks
    .filter((t) => t.type === 'continuous')
    .every((t) => weekPeriodLog(t).is_completed)
  const weekCompleted = weeklyTotal >= minWeeklyPoints && allWeeklyContinuousMet

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black">Tasks</h1>
        <p className="text-gray-500 text-sm">Track your daily and weekly goals</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {['all', 'pending', 'done'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-brand-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
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
                icon="📅"
                title="Daily"
                done={dailyDone}
                total={dailyTasks.length}
                complete={dayCompleted}
                completeLabel="Day Complete!"
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
                icon="🗓️"
                title="Weekly"
                done={weeklyDone}
                total={weeklyTasks.length}
                complete={weekCompleted}
                completeLabel="Week Complete!"
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
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-xl animate-slide-up ${
          toast.type === 'success' ? 'bg-green-700 text-white'
          : toast.type === 'warn'  ? 'bg-amber-700 text-white'
          : 'bg-red-700 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon, title, done, total, complete, completeLabel }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-bold text-gray-200 flex items-center gap-2">
        <span>{icon}</span> {title}
        <span className="text-gray-500 font-normal text-sm">{done}/{total} done</span>
      </h2>
      {complete && <span className="badge-green text-sm px-3 py-1">🎉 {completeLabel}</span>}
    </div>
  )
}

function ProgressBar({ label, value, max, complete }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100))
  return (
    <div className="card py-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
        <span>{label}</span>
        <span>{value} pts · {pct}%</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${complete ? 'bg-green-500' : 'bg-brand-500'}`}
          style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }}
        />
      </div>
    </div>
  )
}

function EmptySection({ filter }) {
  return (
    <div className="card text-center text-gray-500 py-8">
      No {filter === 'all' ? '' : filter + ' '}tasks here.
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card text-center py-16">
      <div className="text-5xl mb-3">📭</div>
      <p className="text-gray-400 font-semibold">No tasks yet</p>
      <p className="text-gray-600 text-sm mt-1">Ask an admin to create some tasks.</p>
    </div>
  )
}
