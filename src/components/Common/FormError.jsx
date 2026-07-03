import { AlertCircle } from 'lucide-react'

export default function FormError({ message }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 text-red-700 text-sm rounded-xl px-3.5 py-2.5">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span className="leading-snug">{message}</span>
    </div>
  )
}
