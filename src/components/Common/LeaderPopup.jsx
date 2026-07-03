import { format, parseISO } from 'date-fns'
import { Trophy, X } from 'lucide-react'

export default function LeaderPopup({ leader, onClose }) {
  const date = leader.summary_date
    ? format(parseISO(leader.summary_date), 'MMMM d, yyyy')
    : 'Yesterday'
  const username = leader.profiles?.username ?? 'Unknown'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-ink-900 border border-ink-800 rounded-2xl shadow-elevated animate-scale-in relative overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-amber-500/15 to-transparent pointer-events-none" />
        <button onClick={onClose} aria-label="Close" className="icon-btn absolute top-3 right-3 z-10">
          <X size={16} />
        </button>

        <div className="relative p-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mb-4">
            <Trophy size={30} className="text-amber-600" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600/90 mb-1.5">
            Leader of the day · {date}
          </p>
          <h2 className="text-2xl font-bold text-ink-100">{username}</h2>
          <p className="text-accent-700 font-semibold text-lg mt-1 tabular-nums">
            {leader.total_points.toLocaleString()} pts
          </p>
          <p className="text-sm text-ink-400 mt-4 leading-relaxed">
            Keep the streak going — today&apos;s top spot is up for grabs.
          </p>
          <button onClick={onClose} className="btn-primary w-full mt-5">Let&apos;s go</button>
        </div>
      </div>
    </div>
  )
}
