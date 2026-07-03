import { useEffect, useState } from 'react'
import { Clock, Sunset } from 'lucide-react'
import { tashkentTimeHM, maghribHM, msUntilNextMaghrib } from '../../lib/islamicTime'

/** Live Tashkent (Uzbekistan) time + today's Maghrib reset time.
 *  The app's "day" (tasks, streaks, leaderboard) rolls over at Maghrib, not
 *  midnight — this makes that visible instead of silent. */
export default function TashkentClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const hoursLeft = Math.max(0, msUntilNextMaghrib(now) / 3_600_000)
  const countdown = hoursLeft >= 1
    ? `${Math.floor(hoursLeft)}h ${Math.round((hoursLeft % 1) * 60)}m`
    : `${Math.round(hoursLeft * 60)}m`

  return (
    <div className="flex items-center gap-2.5 pl-3.5 pr-3.5 py-1.5 rounded-full bg-ink-900 border border-ink-800 shrink-0">
      <Clock size={14} className="text-ink-500" />
      <span className="text-xs font-medium tabular-nums text-ink-200">{tashkentTimeHM(now)}</span>
      <span className="text-ink-300">·</span>
      <Sunset size={14} className="text-amber-500" />
      <span className="text-xs text-ink-500">
        Resets <span className="font-medium text-ink-200 tabular-nums">{maghribHM(now)}</span>
        <span className="hidden sm:inline"> · {countdown}</span>
      </span>
    </div>
  )
}
