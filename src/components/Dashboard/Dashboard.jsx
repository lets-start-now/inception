import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, Flame, Brain, Medal, Trophy, ListChecks, Activity,
  ArrowRight, Crown,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { fetchUserStreaks } from '../../lib/streakLogic'
import { today } from '../../lib/dateUtils'
import { fetchLeaderForDate } from '../../lib/taskLogic'
import TashkentClock from '../Common/TashkentClock'

export default function Dashboard() {
  const { profile } = useAuth()
  const { tasks, logMap, totalPoints, minPoints, dayCompleted, loading } = useApp()
  const [streaks, setStreaks] = useState([])
  const [leader,  setLeader]  = useState(null)
  const [ranking, setRanking] = useState(null)

  useEffect(() => {
    if (!profile) return
    fetchUserStreaks(profile.id).then(setStreaks)
    fetchLeaderForDate(today()).then(setLeader)
    supabase
      .from('daily_summaries')
      .select('user_id, total_points')
      .eq('summary_date', today())
      .order('total_points', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const pos = data.findIndex((s) => s.user_id === profile.id)
        setRanking(pos >= 0 ? pos + 1 : null)
      })
  }, [profile])

  const completedToday = tasks.filter((t) => logMap[t.id]?.is_completed).length
  const habitsCount    = streaks.filter((s) => s.is_habit).length
  const topStreak      = streaks.reduce((max, s) => Math.max(max, s.current_streak), 0)
  const pct            = Math.min(100, Math.round((totalPoints / Math.max(1, minPoints)) * 100))

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hey, {profile?.username}</h1>
          <p className="text-ink-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TashkentClock />
          {dayCompleted && (
            <span className="badge-green px-3 py-1 h-auto text-sm">
              <CheckCircle2 size={15} /> Day complete
            </span>
          )}
        </div>
      </div>

      {/* Hero: daily progress + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progress ring */}
        <div className="card flex items-center gap-5 lg:col-span-1">
          <ProgressRing value={totalPoints} max={minPoints} complete={dayCompleted} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-300">Daily goal</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">
              {totalPoints}
              <span className="text-ink-500 text-lg font-medium"> / {minPoints}</span>
            </p>
            <p className="text-xs text-ink-500 mt-1">
              {dayCompleted ? 'Goal reached' : `${Math.max(0, minPoints - totalPoints)} pts to go`}
            </p>
          </div>
        </div>

        {/* Stat grid */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={CheckCircle2} tint="emerald" label="Tasks done" value={`${completedToday}/${tasks.length}`} />
          <StatCard icon={Flame}        tint="amber"   label="Top streak" value={`${topStreak}d`} />
          <StatCard icon={Brain}        tint="violet"  label="Habits"     value={habitsCount} />
          <StatCard icon={Medal}        tint="accent"  label="Rank today" value={ranking ? `#${ranking}` : '—'} />
        </div>
      </div>

      {/* Leader spotlight */}
      {leader && (
        <div className="card flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/12 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Crown size={20} className="text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Today&apos;s leader</p>
            <p className="font-semibold text-ink-100 truncate">{leader.profiles?.username}</p>
          </div>
          <span className="font-semibold text-amber-600 tabular-nums shrink-0">
            {leader.total_points.toLocaleString()} pts
          </span>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickAction to="/tasks" icon={ListChecks} title="Log tasks"
          subtitle={`${Math.max(0, tasks.length - completedToday)} remaining today`} />
        <QuickAction to="/graph" icon={Activity} title="Activity graph"
          subtitle="View your history" />
      </div>

      {/* Streaks */}
      {streaks.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-1">Streaks &amp; habits</h2>
          <p className="text-xs text-ink-500 mb-4">Your active momentum</p>
          <div className="divide-y divide-ink-800">
            {streaks.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    s.is_habit ? 'bg-violet-500/12 text-violet-600' : 'bg-amber-500/12 text-amber-600'
                  }`}>
                    {s.is_habit ? <Brain size={16} /> : <Flame size={16} />}
                  </div>
                  <span className="text-sm font-medium truncate">{s.tasks?.title}</span>
                  {s.is_habit && <span className="badge-purple">Habit</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!s.is_habit && (
                    <span className="text-sm font-semibold text-amber-600 tabular-nums">{s.current_streak}d</span>
                  )}
                  <span className="text-xs text-ink-500">best {s.longest_streak}d</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressRing({ value, max, complete }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100)
  const r = 44
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative w-[104px] h-[104px] shrink-0">
      <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" strokeWidth="9" className="stroke-ink-800" />
        <circle
          cx="52" cy="52" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
          className={complete ? 'stroke-emerald-500' : 'stroke-accent-500'}
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{Math.round(pct)}%</span>
      </div>
    </div>
  )
}

const TINTS = {
  emerald: 'bg-emerald-500/12 text-emerald-600',
  amber:   'bg-amber-500/12 text-amber-600',
  violet:  'bg-violet-500/12 text-violet-600',
  accent:  'bg-accent-500/12 text-accent-600',
}

function StatCard({ icon: Icon, tint, label, value }) {
  return (
    <div className="card card-interactive p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${TINTS[tint]}`}>
        <Icon size={18} />
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-ink-500 mt-0.5">{label}</div>
    </div>
  )
}

function QuickAction({ to, icon: Icon, title, subtitle }) {
  return (
    <Link to={to} className="card card-interactive group flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-accent-500/12 text-accent-600 flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink-100 group-hover:text-accent-700 transition-colors">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
      </div>
      <ArrowRight size={18} className="text-ink-600 group-hover:text-accent-600 group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-4 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-20 rounded-2xl" />
      </div>
    </div>
  )
}
