import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ full, label }) {
  const spinner = (
    <div className="flex flex-col items-center gap-3 text-ink-400">
      <Loader2 className="animate-spin text-accent-500" size={26} strokeWidth={2.5} />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
  if (full) {
    return <div className="min-h-screen flex items-center justify-center bg-ink-950">{spinner}</div>
  }
  return <div className="flex items-center justify-center py-16">{spinner}</div>
}
