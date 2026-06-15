import { format, parseISO } from 'date-fns'

export default function LeaderPopup({ leader, onClose }) {
  const date = leader.summary_date
    ? format(parseISO(leader.summary_date), 'MMMM d, yyyy')
    : 'Yesterday'

  const username = leader.profiles?.username ?? 'Unknown'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card max-w-sm w-full mx-4 text-center animate-slide-up relative border-purple-700/60">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 text-lg"
        >
          ✕
        </button>

        {/* Trophy */}
        <div className="text-6xl mb-3">🏆</div>
        <p className="text-xs text-purple-400 uppercase tracking-widest font-semibold mb-1">
          Leader of the Day — {date}
        </p>
        <h2 className="text-2xl font-black text-white mb-1">{username}</h2>
        <p className="text-brand-300 font-bold text-lg mb-4">
          {leader.total_points.toLocaleString()} pts
        </p>
        <div className="bg-purple-900/30 rounded-lg px-4 py-2 text-purple-300 text-sm">
          Keep grinding — the top spot is up for grabs today!
        </div>
        <button
          onClick={onClose}
          className="btn-primary w-full mt-4"
        >
          Let's go! ⚡
        </button>
      </div>
    </div>
  )
}
