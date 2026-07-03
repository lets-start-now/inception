import { useState, useEffect } from 'react'

const DEFAULTS = {
  title:             '',
  description:       '',
  frequency:         'daily',
  type:              'one-time',
  recoverable:       false,  // one-time only: false = required, true = optional
  points_per_action: '10',   // keep as string while editing
  daily_threshold:   '1',
  is_active:         true,
}

function toFormValues(task) {
  return {
    ...task,
    frequency:         task.frequency ?? 'daily',
    recoverable:       task.recoverable ?? false,
    points_per_action: String(task.points_per_action ?? 10),
    daily_threshold:   String(task.daily_threshold   ?? 1),
  }
}

export default function TaskForm({ initial, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState(initial ? toFormValues(initial) : { ...DEFAULTS })

  useEffect(() => {
    setForm(initial ? toFormValues(initial) : { ...DEFAULTS })
  }, [initial])

  // Generic change handler — keeps number fields as strings while typing
  function set(field) {
    return (e) => {
      const val =
        e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm((f) => ({ ...f, [field]: val }))
    }
  }

  // Parse + validate numeric fields before handing off to parent
  function handleSubmit(e) {
    e.preventDefault()

    const points = parseInt(form.points_per_action, 10)
    const thresh = parseInt(form.daily_threshold,   10)

    if (!points || points < 1) return alert('Points per action must be at least 1.')
    if (form.type === 'continuous' && (!thresh || thresh < 1))
      return alert('Threshold must be at least 1.')

    onSubmit({
      ...form,
      frequency:         form.frequency === 'weekly' ? 'weekly' : 'daily',
      // recoverable only applies to one-time tasks; continuous stays required.
      recoverable:       form.type === 'one-time' ? !!form.recoverable : false,
      points_per_action: points,
      daily_threshold:   form.type === 'continuous' ? thresh : 1,
    })
  }

  const isWeekly  = form.frequency === 'weekly'
  const period    = isWeekly ? 'week' : 'day'
  const ptsNum    = parseInt(form.points_per_action, 10) || 0
  const threshNum = parseInt(form.daily_threshold,   10) || 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="label">Task Title *</label>
        <input
          className="input"
          value={form.title}
          onChange={set('title')}
          required
          placeholder="e.g. Morning workout"
        />
      </div>

      {/* Description */}
      <div>
        <label className="label">Description</label>
        <textarea
          className="textarea"
          rows={2}
          value={form.description}
          onChange={set('description')}
          placeholder="Optional description"
        />
      </div>

      {/* Frequency + Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Frequency *</label>
          <select className="select" value={form.frequency} onChange={set('frequency')}>
            <option value="daily">Daily (resets each day)</option>
            <option value="weekly">Weekly (resets each week)</option>
          </select>
        </div>
        <div>
          <label className="label">Type *</label>
          <select className="select" value={form.type} onChange={set('type')}>
            <option value="one-time">One-time (once / {period})</option>
            <option value="continuous">Continuous (multiple / {period})</option>
          </select>
        </div>
      </div>

      {/* Points */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Points per Action *</label>
          <input
            className="input"
            type="number"
            min={1}
            max={10000}
            placeholder="10"
            value={form.points_per_action}
            onChange={set('points_per_action')}
            onBlur={() => {
              // restore to '1' if user leaves field blank
              if (form.points_per_action === '' || form.points_per_action === '0')
                setForm((f) => ({ ...f, points_per_action: '1' }))
            }}
            required
          />
        </div>
      </div>

      {/* Threshold (continuous only) */}
      {form.type === 'continuous' && (
        <div>
          <label className="label">
            {isWeekly ? 'Weekly' : 'Daily'} Threshold
            <span className="text-ink-500 font-normal ml-1">
              (actions per {period} needed to mark complete)
            </span>
          </label>
          <input
            className="input"
            type="number"
            min={1}
            max={1000}
            placeholder="3"
            value={form.daily_threshold}
            onChange={set('daily_threshold')}
            onBlur={() => {
              if (form.daily_threshold === '' || form.daily_threshold === '0')
                setForm((f) => ({ ...f, daily_threshold: '1' }))
            }}
            required
          />
        </div>
      )}

      {/* Recoverable (one-time only) */}
      {form.type === 'one-time' && (
        <div>
          <label className="label">
            Completion requirement
            <span className="text-ink-500 font-normal ml-1">(one-time tasks)</span>
          </label>
          <select
            className="select"
            value={form.recoverable ? 'true' : 'false'}
            onChange={(e) => setForm((f) => ({ ...f, recoverable: e.target.value === 'true' }))}
          >
            <option value="false">Non-recoverable — required to finish the {period}</option>
            <option value="true">Recoverable — optional if the points goal is met</option>
          </select>
          <p className="hint mt-0">
            {form.recoverable
              ? `Skipping this is OK as long as the ${isWeekly ? 'weekly' : 'daily'} points goal is reached.`
              : `The ${period} won't count as complete unless this is done, even if points are reached.`}
          </p>
        </div>
      )}

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <input
          id="is_active"
          type="checkbox"
          checked={form.is_active}
          onChange={set('is_active')}
          className="w-4 h-4 accent-brand-500"
        />
        <label htmlFor="is_active" className="text-sm text-ink-200 cursor-pointer">
          Active (visible to users)
        </label>
      </div>

      {/* Live preview */}
      <div className="surface-2 px-4 py-3 text-xs text-ink-400 space-y-1">
        <p className="font-semibold text-ink-200 mb-1.5">Preview</p>
        <p>Frequency: <span className="text-accent-600 capitalize">{form.frequency}</span></p>
        <p>Type: <span className="text-accent-600">{form.type}</span></p>
        {form.type === 'one-time' && (
          <p>
            Requirement:{' '}
            <span className={form.recoverable ? 'text-ink-300' : 'text-amber-600'}>
              {form.recoverable ? 'Recoverable (optional)' : 'Non-recoverable (required)'}
            </span>
          </p>
        )}
        <p>Points: <span className="text-accent-600 tabular-nums">+{ptsNum || '—'} per action</span></p>
        {form.type === 'continuous' && threshNum > 0 && (
          <p>
            Complete at:{' '}
            <span className="text-accent-600 tabular-nums">{threshNum} actions / {period}</span>
            {' '}(= {threshNum * ptsNum} pts minimum)
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Create task'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
