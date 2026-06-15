import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { today } from '../../lib/dateUtils'
import { format, subDays } from 'date-fns'
import LoadingSpinner from '../Common/LoadingSpinner'

export default function Leaderboard() {
  const { profile } = useAuth()
  const [period,   setPeriod]   = useState('today')   // 'today' | '7d' | '30d' | 'all'
  const [entries,  setEntries]  = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [period])

  async function loadLeaderboard() {
    setLoading(true)
    let query = supabase
      .from('daily_summaries')
      .select('user_id, total_points, summary_date, is_leader, profiles(username)')

    if (period === 'today') {
      query = query.eq('summary_date', today())
    } else if (period === '7d') {
      query = query.gte('summary_date', format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    } else if (period === '30d') {
      query = query.gte('summary_date', format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    }

    const { data } = await query

    // Aggregate by user
    const map = {}
    for (const row of data ?? []) {
      const uid = row.user_id
      if (!map[uid]) {
        map[uid] = {
          user_id:  uid,
          username: row.profiles?.username ?? 'Unknown',
          total:    0,
          leader_days: 0,
        }
      }
      map[uid].total       += row.total_points
      if (row.is_leader) map[uid].leader_days += 1
    }

    const sorted = Object.values(map).sort((a, b) => b.total - a.total)
    setEntries(sorted)
    setLoading(false)
  }

  const periods = [
    { key: 'today', label: 'Today'    },
    { key: '7d',    label: '7 Days'   },
    { key: '30d',   label: '30 Days'  },
    { key: 'all',   label: 'All Time' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black">Leaderboard</h1>
        <p className="text-gray-500 text-sm">Top performers by points earned</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {periods.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period === key ? 'bg-brand-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          {entries.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No data for this period.</div>
          ) : (
            <div>
              {entries.map((entry, i) => {
                const isMe      = entry.user_id === profile?.id
                const medals    = ['🥇', '🥈', '🥉']
                const posLabel  = i < 3 ? medals[i] : `#${i + 1}`

                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-4 px-5 py-4 border-b border-gray-800 last:border-0 transition-colors ${
                      isMe ? 'bg-brand-950/40' : 'hover:bg-gray-800/30'
                    }`}
                  >
                    {/* Rank */}
                    <span className="text-xl w-8 text-center shrink-0">{posLabel}</span>

                    {/* Avatar + name */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        i === 0 ? 'bg-amber-600/40 text-amber-300'
                        : i === 1 ? 'bg-gray-600/40 text-gray-300'
                        : i === 2 ? 'bg-orange-700/40 text-orange-300'
                        : 'bg-gray-800 text-gray-400'
                      }`}>
                        {entry.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold truncate ${isMe ? 'text-brand-300' : ''}`}>
                          {entry.username}
                          {isMe && <span className="text-xs text-brand-500 ml-1.5">(you)</span>}
                        </p>
                        {entry.leader_days > 0 && (
                          <p className="text-xs text-purple-400">
                            👑 Leader {entry.leader_days}×
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Points */}
                    <span className={`font-mono font-bold shrink-0 ${
                      i === 0 ? 'text-amber-400 text-lg'
                      : i === 1 ? 'text-gray-300 text-lg'
                      : 'text-gray-400'
                    }`}>
                      {entry.total.toLocaleString()} pts
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
