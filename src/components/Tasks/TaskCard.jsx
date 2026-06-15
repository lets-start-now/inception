import { useState } from 'react'

export default function TaskCard({ task, log, onLog, onUndo }) {
  const [busyLog,  setBusyLog]  = useState(false)
  const [busyUndo, setBusyUndo] = useState(false)

  const isOneTime   = task.type === 'one-time'
  const isWeekly    = task.frequency === 'weekly'
  const period      = isWeekly ? 'week' : 'day'
  const count       = log?.action_count  ?? 0
  const points      = log?.points_earned ?? 0
  const isCompleted = log?.is_completed  ?? false

  const threshold   = task.daily_threshold
  const progressPct = isOneTime
    ? (isCompleted ? 100 : 0)
    : Math.min(100, Math.round((count / threshold) * 100))

  const canLog  = !(isOneTime && isCompleted)
  const canUndo = count > 0 || isCompleted   // something to undo

  async function handleLog() {
    setBusyLog(true)
    await onLog(task)
    setBusyLog(false)
  }

  async function handleUndo() {
    setBusyUndo(true)
    await onUndo(task)
    setBusyUndo(false)
  }

  return (
    <div className={`card transition-all ${isCompleted ? 'border-green-800/60 bg-green-950/10' : ''}`}>
      <div className="flex items-start justify-between gap-3">

        {/* ── Left: info ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{task.title}</span>
            {isWeekly && <span className="badge-blue">Weekly</span>}
            {isCompleted && <span className="badge-green">✓ Done</span>}
            {task.type === 'continuous' && !isCompleted && count > 0 && (
              <span className="badge-amber">{count}/{threshold}</span>
            )}
            {task.type === 'continuous' && count > threshold && (
              <span className="badge-purple">+{count - threshold} bonus</span>
            )}
          </div>

          {task.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs text-gray-500">
              {isOneTime
                ? (isWeekly ? 'Once / week' : 'Once / day')
                : `${threshold} to complete · per ${period}`}
            </span>
            <span className="text-xs font-mono text-brand-400">
              +{task.points_per_action} pts/action
            </span>
            {points > 0 && (
              <span className="text-xs font-mono text-green-400">
                {points} pts this {period}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-2.5 w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCompleted ? 'bg-green-500' : 'bg-brand-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* ── Right: undo + log buttons ────────────────────────── */}
        <div className="flex items-center gap-1.5 shrink-0">

          {/* Undo / − button */}
          <button
            onClick={handleUndo}
            disabled={!canUndo || busyUndo}
            title={isOneTime ? 'Undo completion' : 'Remove one action'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold transition-all ${
              canUndo
                ? 'bg-gray-700 hover:bg-red-800/70 text-gray-300 hover:text-red-300 active:scale-95'
                : 'bg-gray-800/40 text-gray-700 cursor-default'
            }`}
          >
            {busyUndo ? (
              <span className="w-3.5 h-3.5 border-2 border-gray-400/40 border-t-gray-300 rounded-full animate-spin block" />
            ) : (
              '−'
            )}
          </button>

          {/* Log / + button */}
          <button
            onClick={handleLog}
            disabled={!canLog || busyLog}
            title={isOneTime && isCompleted ? 'Already done today' : 'Log action'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold transition-all ${
              isCompleted && isOneTime
                ? 'bg-green-900/40 text-green-500 cursor-default'
                : canLog
                ? 'bg-brand-700 hover:bg-brand-600 text-white active:scale-95'
                : 'bg-gray-800 text-gray-600 cursor-default'
            }`}
          >
            {busyLog ? (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin block" />
            ) : isCompleted && isOneTime ? (
              '✓'
            ) : (
              '+'
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
