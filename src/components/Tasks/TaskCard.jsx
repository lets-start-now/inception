import { useState } from 'react'
import { Plus, Minus, Check, Loader2 } from 'lucide-react'

export default function TaskCard({ task, log, onLog, onUndo }) {
  const [busyLog,  setBusyLog]  = useState(false)
  const [busyUndo, setBusyUndo] = useState(false)

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

  async function handleLog()  { setBusyLog(true);  await onLog(task);  setBusyLog(false)  }
  async function handleUndo() { setBusyUndo(true); await onUndo(task); setBusyUndo(false) }

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

          {/* Progress */}
          <div className="mt-3 track h-1.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isCompleted ? 'bg-emerald-500' : 'bg-accent-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleUndo}
            disabled={!canUndo || busyUndo}
            aria-label="Remove one action"
            title={isOneTime ? 'Undo completion' : 'Remove one action'}
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
            title={isOneTime && isCompleted ? 'Already done' : 'Log action'}
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
  )
}
