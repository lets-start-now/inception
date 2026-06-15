import { useEffect, useState } from 'react'
import { format, parseISO, getDay, startOfWeek, addDays, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { last365Days, today } from '../../lib/dateUtils'
import LoadingSpinner from '../Common/LoadingSpinner'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ContributionGraph() {
  const { profile } = useAuth()
  const [summaries, setSummaries] = useState({})  // date → summary row
  const [loading,   setLoading]   = useState(true)
  const [hovered,   setHovered]   = useState(null)
  const [stats,     setStats]     = useState({ completed: 0, leader: 0, streak: 0 })

  useEffect(() => {
    if (!profile) return
    loadData()
  }, [profile])

  async function loadData() {
    setLoading(true)
    const since = format(subDays(new Date(), 364), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', profile.id)
      .gte('summary_date', since)
      .order('summary_date')

    const map = {}
    let completed = 0, leader = 0
    for (const row of data ?? []) {
      map[row.summary_date] = row
      if (row.is_day_completed) completed++
      if (row.is_leader)        leader++
    }

    // Calculate current streak
    let streak = 0
    const days = last365Days().reverse()
    for (const d of days) {
      if (d === today() && !map[d]?.is_day_completed) continue
      if (map[d]?.is_day_completed) streak++
      else break
    }

    setSummaries(map)
    setStats({ completed, leader, streak })
    setLoading(false)
  }

  // Build weeks array for the grid
  const days365   = last365Days()
  const firstDay  = parseISO(days365[0])
  // Pad the start so week starts on Sunday
  const startPad  = getDay(firstDay)
  const cells     = [
    ...Array(startPad).fill(null),
    ...days365,
  ]
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  // Month labels: find first cell of each month in the weeks grid
  const monthLabels = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    for (const d of week) {
      if (!d) continue
      const m = parseISO(d).getMonth()
      if (m !== lastMonth) {
        monthLabels.push({ wi, label: MONTHS[m] })
        lastMonth = m
        break
      }
    }
  })

  function cellColor(date) {
    if (!date) return 'transparent'
    const s = summaries[date]
    if (!s || s.total_points === 0) return 'bg-gray-800'
    if (s.is_leader)        return 'bg-purple-500'
    if (s.is_day_completed) return 'bg-green-500'
    return 'bg-green-800'  // has some points but not complete
  }

  function cellTitle(date) {
    if (!date) return ''
    const s = summaries[date]
    const pts = s?.total_points ?? 0
    const label = format(parseISO(date), 'MMM d, yyyy')
    if (!s || pts === 0) return `${label} — no activity`
    const flags = []
    if (s.is_day_completed) flags.push('Day complete')
    if (s.is_leader)        flags.push('Leader!')
    return `${label} — ${pts} pts${flags.length ? ' · ' + flags.join(', ') : ''}`
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black">Contribution Graph</h1>
        <p className="text-gray-500 text-sm">Your activity over the last 365 days</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-black text-green-400">{stats.completed}</div>
          <div className="text-xs text-gray-500 mt-0.5">Days Completed</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-black text-purple-400">{stats.leader}</div>
          <div className="text-xs text-gray-500 mt-0.5">Leader Days</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-black text-amber-400">{stats.streak}</div>
          <div className="text-xs text-gray-500 mt-0.5">Current Streak</div>
        </div>
      </div>

      {/* Graph */}
      <div className="card overflow-x-auto">
        {/* Month labels */}
        <div className="flex gap-[3px] mb-1 ml-6">
          {weeks.map((_, wi) => {
            const lbl = monthLabels.find((m) => m.wi === wi)
            return (
              <div key={wi} className="w-[13px] shrink-0 text-[9px] text-gray-600">
                {lbl?.label ?? ''}
              </div>
            )
          })}
        </div>

        <div className="flex gap-[3px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mr-1">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} className="h-[13px] text-[9px] text-gray-600 leading-[13px]">{i % 2 === 1 ? d : ''}</div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((date, di) => (
                <div
                  key={di}
                  title={cellTitle(date)}
                  onMouseEnter={() => date && setHovered({ date, summary: summaries[date] })}
                  onMouseLeave={() => setHovered(null)}
                  className={`w-[13px] h-[13px] rounded-sm cursor-default transition-opacity hover:opacity-80 ${
                    date ? cellColor(date) : ''
                  }`}
                  style={!date ? { backgroundColor: 'transparent' } : undefined}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-800" />
            <div className="w-3 h-3 rounded-sm bg-green-800" />
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <div className="w-3 h-3 rounded-sm bg-purple-500" />
          </div>
          <span>More</span>
          <div className="flex items-center gap-1 ml-2">
            <div className="w-3 h-3 rounded-sm bg-purple-500" />
            <span>Leader day</span>
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="card border-gray-700 text-sm animate-fade-in">
          <p className="font-semibold">{format(parseISO(hovered.date), 'EEEE, MMMM d, yyyy')}</p>
          {hovered.summary ? (
            <div className="mt-1 space-y-0.5 text-gray-400">
              <p>Points: <span className="text-brand-400 font-mono">{hovered.summary.total_points}</span></p>
              <p>Day complete: <span className={hovered.summary.is_day_completed ? 'text-green-400' : 'text-gray-600'}>
                {hovered.summary.is_day_completed ? 'Yes ✓' : 'No'}
              </span></p>
              {hovered.summary.is_leader && <p className="text-purple-400">👑 Leader of the day!</p>}
            </div>
          ) : (
            <p className="text-gray-600 mt-1">No activity recorded.</p>
          )}
        </div>
      )}
    </div>
  )
}
