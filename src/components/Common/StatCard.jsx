const TINTS = {
  emerald: 'bg-emerald-500/12 text-emerald-600',
  amber:   'bg-amber-500/12 text-amber-600',
  violet:  'bg-violet-500/12 text-violet-600',
  accent:  'bg-accent-500/12 text-accent-600',
  rose:    'bg-rose-500/12 text-rose-600',
}

export default function StatCard({ icon: Icon, tint = 'accent', label, value, interactive = true }) {
  return (
    <div className={`card p-3.5 flex items-center gap-3 ${interactive ? 'card-interactive' : ''}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TINTS[tint]}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold tabular-nums leading-tight truncate">{value}</div>
        <div className="text-xs text-ink-500 truncate">{label}</div>
      </div>
    </div>
  )
}
