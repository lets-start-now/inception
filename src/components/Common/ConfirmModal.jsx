import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel, danger }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-ink-900 border border-ink-800 rounded-2xl shadow-elevated animate-scale-in"
      >
        <div className="p-6 flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            danger ? 'bg-red-500/12 text-red-600' : 'bg-accent-500/12 text-accent-600'
          }`}>
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-ink-100">{title}</h3>
            <p className="text-sm text-ink-400 mt-1.5 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} aria-label="Close" className="icon-btn -mt-1 -mr-1">
            <X size={16} />
          </button>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-ink-800">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
