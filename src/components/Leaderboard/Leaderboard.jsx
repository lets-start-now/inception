import { useEffect, useState } from 'react'
import { Crown, Trophy, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { today } from '../../lib/dateUtils'
import { format, subDays, parseISO } from 'date-fns'

const periods = [
  { key: 'today', label: 'Today'    },
  { key: '7d',    label: '7 days'   },
  { key: '30d',   label: '30 days'  },
  { key: 'all',   label: 'All time' },
]

export default function Leaderboard() {
  const { profile } = useAuth()
  const [period,  setPeriod]  = useState('today')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadLeaderboard() }, [period])

  async function loadLeaderboard() {
    setLoading(true)
    let sumQuery = supabase
      .from('daily_summaries')
      .select('user_id, total_points, is_leader, summary_date')

    const todayStr = today()
    if (period === 'today')    sumQuery = sumQuery.eq('summary_date', todayStr)
    else if (period === '7d')  sumQuery = sumQuery.gte('summary_date', format(subDays(parseISO(todayStr), 7), 'yyyy-MM-dd'))
    else if (period === '30d') sumQuery = sumQuery.gte('summary_date', format(subDays(parseISO(todayStr), 30), 'yyyy-MM-dd'))

    // Fetch every user so those with 0 points (or no activity yet) still appear.
    const [{ data: sums }, { data: profs }] = await Promise.all([
      sumQuery,
      supabase.from('profiles').select('id, username'),
    ])

    const agg = {}
    for (const row of sums ?? []) {
      const a = agg[row.user_id] ?? (agg[row.user_id] = { total: 0, leader_days: 0 })
      a.total += row.total_points
      if (row.is_leader) a.leader_days += 1
    }

    const entries = (profs ?? []).map((p) => ({
      user_id:     p.id,
      username:    p.username,
      total:       agg[p.id]?.total ?? 0,
      leader_days: agg[p.id]?.leader_days ?? 0,
    }))

    // Highest points first; alphabetical tiebreaker so 0-point users are stable.
    entries.sort((a, b) => b.total - a.total || a.username.localeCompare(b.username))
    setEntries(entries)
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-ink-400 text-sm mt-1">Top performers by points earned</p>
      </div>

      <div className="segmented">
        {periods.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`segmented-item ${period === key ? 'segmented-item-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-2 space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3">
              <div className="skeleton w-6 h-4" />
              <div className="skeleton w-9 h-9 rounded-full" />
              <div className="skeleton h-4 flex-1 max-w-[160px]" />
              <div className="skeleton h-4 w-16 ml-auto" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="card flex flex-col items-center text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-ink-800 flex items-center justify-center mb-4">
            <Users size={26} className="text-ink-500" />
          </div>
          <p className="font-semibold text-ink-200">No data yet</p>
          <p className="text-ink-500 text-sm mt-1">Nothing recorded for this period.</p>
        </div>
      ) : (
        <div className="card p-2">
          {entries.map((entry, i) => {
            const isMe = entry.user_id === profile?.id
            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-colors ${
                  isMe ? 'bg-accent-500/10' : 'hover:bg-ink-800/60'
                }`}
              >
                <Rank index={i} />
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                    i === 0 ? 'bg-amber-500/15 text-amber-700'
                    : i === 1 ? 'bg-ink-700 text-ink-200'
                    : i === 2 ? 'bg-orange-500/15 text-orange-700'
                    : 'bg-ink-800 text-ink-400'
                  }`}>
                    {entry.username[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-medium truncate ${isMe ? 'text-accent-700' : 'text-ink-100'}`}>
                      {entry.username}
                      {isMe && <span className="text-xs text-accent-500/90 ml-1.5 font-normal">you</span>}
                    </p>
                    {entry.leader_days > 0 && (
                      <p className="text-xs text-amber-600/90 flex items-center gap-1 mt-0.5">
                        <Crown size={11} /> Leader {entry.leader_days}×
                      </p>
                    )}
                  </div>
                </div>
                <span className={`font-semibold tabular-nums shrink-0 ${
                  i === 0 ? 'text-amber-600' : 'text-ink-200'
                }`}>
                  {entry.total.toLocaleString()}
                  <span className="text-ink-500 font-normal text-sm"> pts</span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Rank({ index }) {
  if (index === 0) {
    return (
      <span className="w-7 flex justify-center shrink-0">
        <Trophy size={18} className="text-amber-600" />
      </span>
    )
  }
  const color = index === 1 ? 'text-ink-300' : index === 2 ? 'text-orange-600' : 'text-ink-500'
  return <span className={`w-7 text-center text-sm font-semibold tabular-nums shrink-0 ${color}`}>{index + 1}</span>
}
