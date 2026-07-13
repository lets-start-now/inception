import { useEffect, useRef, useState } from 'react'
import { format, parseISO, getDay, subDays, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { CheckCircle2, Crown, Flame, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { last365Days, today } from '../../lib/dateUtils'
import StatCard from '../Common/StatCard'
import LoadingSpinner from '../Common/LoadingSpinner'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * A user's activity heatmap (full year on desktop, one navigable month on
 * mobile) plus the optional mini stats row above it. Reused by the "Activity"
 * page (for the signed-in user) and the Profile page (for any user).
 */
export default function ContributionCalendar({ userId, showStats = true }) {
  const [summaries, setSummaries] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [hovered,   setHovered]   = useState(null)
  const [stats,     setStats]     = useState({ completed: 0, leader: 0, streak: 0 })
  const [cursor,    setCursor]    = useState(() => startOfMonth(new Date()))
  const scrollRef = useRef(null)
  const detailRef = useRef(null)

  useEffect(() => { if (userId) loadData() }, [userId])

  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [loading])

  useEffect(() => {
    if (hovered && window.innerWidth < 640 && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [hovered])

  async function loadData() {
    setLoading(true)
    const since = format(subDays(parseISO(today()), 364), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('daily_summaries').select('*')
      .eq('user_id', userId).gte('summary_date', since).order('summary_date')

    const map = {}
    let completed = 0, leader = 0
    for (const row of data ?? []) {
      map[row.summary_date] = row
      if (row.is_day_completed) completed++
      if (row.is_leader)        leader++
    }
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
    setCursor(startOfMonth(parseISO(today())))
  }

  const days365  = last365Days()
  const firstDay = parseISO(days365[0])
  const startPad = getDay(firstDay)
  const cells    = [...Array(startPad).fill(null), ...days365]
  const weeks    = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const monthLabels = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    for (const d of week) {
      if (!d) continue
      const m = parseISO(d).getMonth()
      if (m !== lastMonth) { monthLabels.push({ wi, label: MONTHS[m] }); lastMonth = m; break }
    }
  })

  const activityDates = Object.keys(summaries)
  const earliest  = activityDates.length ? activityDates.sort()[0] : format(new Date(), 'yyyy-MM-dd')
  const minMonth  = format(startOfMonth(parseISO(earliest)), 'yyyy-MM')
  const maxMonth  = format(startOfMonth(new Date()), 'yyyy-MM')
  const cursorKey = format(cursor, 'yyyy-MM')
  const canPrev   = cursorKey > minMonth
  const canNext   = cursorKey < maxMonth

  function cellColor(date) {
    if (!date) return 'transparent'
    const s = summaries[date]
    if (!s || s.total_points === 0) return 'bg-ink-800'
    if (s.is_leader)        return 'bg-amber-400'
    if (s.is_day_completed) return 'bg-emerald-500'
    return 'bg-emerald-500/35'
  }

  function cellTitle(date) {
    if (!date) return ''
    const s = summaries[date]
    const pts = s?.total_points ?? 0
    const label = format(parseISO(date), 'MMM d, yyyy')
    if (!s || pts === 0) return `${label} — no activity`
    const flags = []
    if (s.is_day_completed) flags.push('Day complete')
    if (s.is_leader)        flags.push('Leader')
    return `${label} — ${pts} pts${flags.length ? ' · ' + flags.join(', ') : ''}`
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      {showStats && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={CheckCircle2} tint="emerald" value={stats.completed}    label="Days completed" interactive={false} />
          <StatCard icon={Crown}        tint="amber"   value={stats.leader}       label="Leader days"    interactive={false} />
          <StatCard icon={Flame}        tint="amber"   value={`${stats.streak}d`} label="Current streak" interactive={false} />
        </div>
      )}

      {/* Desktop: full-year heatmap */}
      <div className="card hidden sm:block">
        <div ref={scrollRef} className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="inline-block min-w-max">
            <div className="flex gap-[3px] mb-1 ml-7">
              {weeks.map((_, wi) => {
                const lbl = monthLabels.find((m) => m.wi === wi)
                return <div key={wi} className="w-[12px] shrink-0 text-[9px] text-ink-500">{lbl?.label ?? ''}</div>
              })}
            </div>
            <div className="flex gap-[3px]">
              <div className="flex flex-col gap-[3px] mr-1.5">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} className="h-[12px] text-[9px] text-ink-500 leading-[12px]">{i % 2 === 1 ? d : ''}</div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((date, di) => (
                    <div
                      key={di}
                      title={cellTitle(date)}
                      onMouseEnter={() => date && setHovered({ date, summary: summaries[date] })}
                      onMouseLeave={() => setHovered(null)}
                      className={`w-[12px] h-[12px] rounded-[3px] transition-all hover:ring-1 hover:ring-ink-500 ${date ? cellColor(date) : ''}`}
                      style={!date ? { backgroundColor: 'transparent' } : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-4 text-xs text-ink-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-[3px] bg-ink-800" />
            <div className="w-3 h-3 rounded-[3px] bg-emerald-500/35" />
            <div className="w-3 h-3 rounded-[3px] bg-emerald-500" />
          </div>
          <span>More</span>
          <div className="flex items-center gap-1.5 ml-3">
            <div className="w-3 h-3 rounded-[3px] bg-amber-400" />
            <span>Leader day</span>
          </div>
        </div>
      </div>

      {/* Mobile: one month at a time, navigable within the active range */}
      <div className="card sm:hidden">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(subMonths(cursor, 1))} disabled={!canPrev} aria-label="Previous month" className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-semibold text-ink-100">{format(cursor, 'MMMM yyyy')}</p>
          <button onClick={() => setCursor(addMonths(cursor, 1))} disabled={!canNext} aria-label="Next month" className="icon-btn">
            <ChevronRight size={18} />
          </button>
        </div>

        <MonthGrid monthDate={cursor} summaries={summaries} cellColor={cellColor} cellTitle={cellTitle} onSelect={setHovered} />

        <div className="flex items-center flex-wrap gap-x-3 gap-y-2 text-xs text-ink-500 mt-5 pt-4 border-t border-ink-800">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[4px] bg-emerald-500" /><span>Completed</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[4px] bg-emerald-500/35" /><span>Active</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[4px] bg-amber-400" /><span>Leader</span></div>
        </div>
      </div>

      {hovered && (
        <div ref={detailRef} className="card border-ink-700 text-sm animate-fade-in">
          <p className="font-medium text-ink-100">{format(parseISO(hovered.date), 'EEEE, MMMM d, yyyy')}</p>
          {hovered.summary ? (
            <div className="mt-1.5 space-y-1 text-ink-400">
              <p>Points: <span className="text-accent-600 font-medium tabular-nums">{hovered.summary.total_points}</span></p>
              <p>Day complete:{' '}
                <span className={hovered.summary.is_day_completed ? 'text-emerald-600' : 'text-ink-500'}>
                  {hovered.summary.is_day_completed ? 'Yes' : 'No'}
                </span>
              </p>
              {hovered.summary.is_leader && <p className="text-amber-600 flex items-center gap-1"><Crown size={13} /> Leader of the day</p>}
            </div>
          ) : (
            <p className="text-ink-500 mt-1">No activity recorded.</p>
          )}
        </div>
      )}
    </div>
  )
}

function MonthGrid({ monthDate, summaries, cellColor, cellTitle, onSelect }) {
  const start = startOfMonth(monthDate)
  const days  = eachDayOfInterval({ start, end: endOfMonth(monthDate) })
  const pad   = (getDay(start) + 6) % 7
  const todayStr = today()

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-ink-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: pad }).map((_, i) => <div key={`p${i}`} />)}
        {days.map((d) => {
          const ds = format(d, 'yyyy-MM-dd')
          const future = ds > todayStr
          return (
            <button
              key={ds}
              title={cellTitle(ds)}
              onClick={() => onSelect({ date: ds, summary: summaries[ds] })}
              className={`aspect-square rounded-lg transition-all active:scale-90 ${
                future ? 'bg-ink-900 border border-ink-800/60' : `${cellColor(ds)} hover:ring-2 hover:ring-ink-600`
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
