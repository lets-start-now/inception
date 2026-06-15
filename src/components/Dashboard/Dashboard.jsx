import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { fetchUserStreaks } from '../../lib/streakLogic'
import { today, yesterday } from '../../lib/dateUtils'
import { fetchLeaderForDate } from '../../lib/taskLogic'

export default function Dashboard() {
  const { profile } = useAuth()
  const { tasks, logMap, totalPoints, minPoints, dayCompleted, loading } = useApp()
  const [streaks,  setStreaks]  = useState([])
  const [leader,   setLeader]   = useState(null)
  const [ranking,  setRanking]  = useState(null)

  useEffect(() => {
    if (!profile) return
    fetchUserStreaks(profile.id).then(setStreaks)
    fetchLeaderForDate(today()).then(setLeader)

    // Get today's leaderboard position
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
  const pct            = Math.min(100, Math.round((totalPoints / minPoints) * 100))

  if (loading) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">
            Hey, {profile?.username} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {dayCompleted && (
          <span className="badge-green text-base px-3 py-1">
            ✓ Day Complete!
          </span>
        )}
      </div>

      {/* Daily progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-200">Daily Progress</h2>
          <span className="text-sm font-mono text-brand-400">
            {totalPoints} / {minPoints} pts
          </span>
        </div>
        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${dayCompleted ? 'bg-green-500' : 'bg-brand-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1.5">
          <span>{pct}% complete</span>
          <span>{Math.max(0, minPoints - totalPoints)} pts to go</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon="✅" label="Tasks Done" value={`${completedToday}/${tasks.length}`} color="green" />
        <StatCard icon="🔥" label="Top Streak"  value={`${topStreak}d`}                     color="orange" />
        <StatCard icon="🧠" label="Habits"       value={habitsCount}                          color="purple" />
        <StatCard icon="🏅" label="Rank Today"   value={ranking ? `#${ranking}` : '—'}        color="blue" />
      </div>

      {/* Leader spotlight */}
      {leader && (
        <div className="card border-purple-800/60 bg-purple-950/20">
          <p className="text-xs text-purple-400 uppercase tracking-widest font-semibold mb-1">
            Today's current leader
          </p>
          <div className="flex items-center justify-between">
            <span className="font-bold text-lg">{leader.profiles?.username}</span>
            <span className="text-purple-300 font-mono font-bold">
              {leader.total_points.toLocaleString()} pts
            </span>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/tasks" className="card hover:border-brand-700/60 transition-colors cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-900/50 rounded-lg flex items-center justify-center text-xl">
              ✅
            </div>
            <div>
              <p className="font-semibold group-hover:text-brand-300 transition-colors">Log Tasks</p>
              <p className="text-xs text-gray-500">
                {tasks.length - completedToday} tasks remaining
              </p>
            </div>
          </div>
        </Link>
        <Link to="/graph" className="card hover:border-green-700/60 transition-colors cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-900/50 rounded-lg flex items-center justify-center text-xl">
              📊
            </div>
            <div>
              <p className="font-semibold group-hover:text-green-300 transition-colors">Contribution Graph</p>
              <p className="text-xs text-gray-500">View your activity history</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Streaks list */}
      {streaks.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-4">Streaks & Habits</h2>
          <div className="space-y-2">
            {streaks.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span>{s.is_habit ? '🧠' : '🔥'}</span>
                  <span className="text-sm font-medium truncate">{s.tasks?.title}</span>
                  {s.is_habit && <span className="badge-purple">Habit</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!s.is_habit && (
                    <span className="text-sm font-mono text-amber-400">{s.current_streak}d</span>
                  )}
                  <span className="text-xs text-gray-500">best: {s.longest_streak}d</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    green:  'bg-green-900/30 border-green-800/50 text-green-400',
    orange: 'bg-amber-900/30 border-amber-800/50 text-amber-400',
    purple: 'bg-purple-900/30 border-purple-800/50 text-purple-400',
    blue:   'bg-blue-900/30 border-blue-800/50 text-blue-400',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs opacity-70 mt-0.5">{label}</div>
    </div>
  )
}
