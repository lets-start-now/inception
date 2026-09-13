import { useState } from 'react'
import { Plus, Minus, Check, Loader2, AlertTriangle, Settings2 } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function TaskCard({
  task, log, onLog, onUndo,
  isPassive   = false,
  isAtRisk    = false,
  onActivate,               // () => void  — activate today (passive cards only)
  schedule,                 // int[]  — active_days for this task
  onScheduleChange,         // (days: int[]) => void
}) {
  const [busyLog,      setBusyLog]      = useState(false)
  const [busyUndo,     setBusyUndo]     = useState(false)
  const [busyActivate, setBusyActivate] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)

  const isOneTime   = task.type === 'one-time'
  const isWeekly    = task.frequency === 'weekly'
  const period      = isWeekly ? 'week' : 'day'
  const isRequired  = isOneTime && task.recoverable === false
  const count       = log?.action_count  ?? 0
  const points      = log?.points_earned ?? 0
  const isCompleted = log?.is_completed  ?? false
  const threshold   = task.daily_threshold
  const progressPct = isOneTime
    ? (isCompleted ? 100 : 0)
    : Math.min(100, Math.round((count / threshold) * 100))
  const canLog  = !(isOneTime && isCompleted)
  const canUndo = count > 0 || isCompleted

  async function handleLog()  { setBusyLog(true);  await onLog(task);  setBusyLog(false) }
  async function handleUndo() { setBusyUndo(true); await onUndo(task); setBusyUndo(false) }
  async function handleActivate() {
    setBusyActivate(true)
    await onActivate()
    setBusyActivate(false)
  }

  // ── Passive card ──────────────────────────────────────────────────────────
  if (isPassive) {
    return (
      <div className="card p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-ink-500 truncate">{task.title}</span>
              <span className="badge-gray">Rest day</span>
            </div>
            {task.description && (
              <p className="text-xs text-ink-600 mt-0.5 truncate">{task.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleActivate}
              disabled={busyActivate}
              className="btn-secondary btn-sm disabled:opacity-60"
            >
              {busyActivate ? <Loader2 size={13} className="animate-spin" /> : 'Activate today'}
            </button>
            <button
              onClick={() => setShowSchedule((v) => !v)}
              aria-label="Edit schedule"
              title="Edit weekly schedule"
              className={`icon-btn ${showSchedule ? 'text-accent-600' : ''}`}
            >
              <Settings2 size={15} />
            </button>
          </div>
        </div>
        {showSchedule && schedule !== undefined && (
          <ScheduleEditor activeDays={schedule} onChange={onScheduleChange} />
        )}
      </div>
    )
  }

  // ── Normal card ───────────────────────────────────────────────────────────
  return (
    <div className={`card p-4 transition-colors ${isCompleted ? 'border-emerald-200 bg-emerald-50/60' : 'card-interactive'}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink-100 truncate">{task.title}</span>
            {isWeekly && <span className="badge-blue">Weekly</span>}
            {isRequired && !isCompleted && <span className="badge-amber">Required</span>}
            {isCompleted && <span className="badge-green"><Check size={11} strokeWidth={3} /> Done</span>}
            {task.type === 'continuous' && !isCompleted && count > 0 && (
              <span className="badge-gray tabular-nums">{count}/{threshold}</span>
            )}
            {task.type === 'continuous' && count > threshold && (
              <span className="badge-purple">+{count - threshold} bonus</span>
            )}
          </div>

          {isAtRisk && (
            <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
              <AlertTriangle size={11} /> Skipping today breaks your habit
            </p>
          )}

          {task.description && (
            <p className="text-xs text-ink-500 mt-1 truncate">{task.description}</p>
          )}

          <div className="flex items-center gap-x-3 gap-y-1 mt-2 flex-wrap text-xs">
            <span className="text-ink-500">
              {isOneTime
                ? (isWeekly ? 'Once / week' : 'Once / day')
                : `${threshold} to complete · per ${period}`}
            </span>
            <span className="font-medium text-accent-600 tabular-nums">+{task.points_per_action} pts</span>
            {points > 0 && (
              <span className="font-medium text-emerald-600 tabular-nums">{points} pts this {period}</span>
            )}
          </div>

          <div className="mt-3 track h-1.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isCompleted ? 'bg-emerald-500' : 'bg-accent-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSchedule((v) => !v)}
              aria-label="Edit schedule"
              title="Edit weekly schedule"
              className={`icon-btn ${showSchedule ? 'text-accent-600' : ''}`}
            >
              <Settings2 size={14} />
            </button>
            <button
              onClick={handleUndo}
              disabled={!canUndo || busyUndo}
              aria-label="Remove one action"
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-95
                         bg-ink-800 text-ink-300 hover:bg-red-500/15 hover:text-red-600
                         disabled:opacity-40 disabled:pointer-events-none"
            >
              {busyUndo ? <Loader2 size={15} className="animate-spin" /> : <Minus size={16} />}
            </button>
            <button
              onClick={handleLog}
              disabled={!canLog || busyLog}
              aria-label="Log action"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:pointer-events-none ${
                isCompleted && isOneTime
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : 'bg-accent-600 text-white hover:bg-accent-500 shadow-soft'
              }`}
            >
              {busyLog
                ? <Loader2 size={15} className="animate-spin" />
                : isCompleted && isOneTime ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
            </button>
          </div>
        </div>
      </div>

      {showSchedule && schedule !== undefined && (
        <ScheduleEditor activeDays={schedule} onChange={onScheduleChange} />
      )}
    </div>
  )
}

function ScheduleEditor({ activeDays, onChange }) {
  function toggle(i) {
    const next = activeDays.includes(i)
      ? activeDays.filter((d) => d !== i)
      : [...activeDays, i].sort((a, b) => a - b)
    if (next.length === 0) return  // prevent deactivating all days
    onChange(next)
  }

  return (
    <div className="mt-3 pt-3 border-t border-ink-800">
      <p className="text-xs text-ink-500 mb-2">Active days (tap to toggle)</p>
      <div className="flex gap-1.5">
        {DAYS.map((d, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
              activeDays.includes(i)
                ? 'bg-accent-600 text-white'
                : 'bg-ink-800 text-ink-500 hover:text-ink-300'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}
