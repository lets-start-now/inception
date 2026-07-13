import { Brain, Flame } from 'lucide-react'

/** Compact grid of streak chips. Shared by the Dashboard and Profile page. */
export default function StreakList({ streaks, subtitle }) {
  if (streaks.length === 0) return null

  return (
    <div className="card">
      <h2 className="font-semibold mb-1">Streaks &amp; habits</h2>
      <p className="text-xs text-ink-500 mb-4">{subtitle}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {streaks.map((s) => <StreakCard key={s.id} streak={s} />)}
      </div>
    </div>
  )
}

function StreakCard({ streak: s }) {
  return (
    <div className="surface-2 rounded-lg p-2.5 flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
        s.is_habit ? 'bg-violet-500/12 text-violet-600' : 'bg-amber-500/12 text-amber-600'
      }`}>
        {s.is_habit ? <Brain size={14} /> : <Flame size={14} />}
      </div>
      <p className="text-sm font-medium text-ink-100 truncate flex-1 min-w-0">{s.tasks?.title}</p>
      {s.is_habit
        ? <span className="badge-purple shrink-0">Habit</span>
        : <span className="text-xs font-semibold text-amber-600 tabular-nums shrink-0">{s.current_streak}d</span>}
      <span className="text-xs text-ink-500 shrink-0">best {s.longest_streak}d</span>
    </div>
  )
}
