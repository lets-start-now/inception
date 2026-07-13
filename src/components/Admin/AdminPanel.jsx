import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Power, Inbox, UserCircle } from 'lucide-react'
import Avatar from '../Common/Avatar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import TaskForm from './TaskForm'
import ConfirmModal from '../Common/ConfirmModal'
import LoadingSpinner from '../Common/LoadingSpinner'

export default function AdminPanel() {
  const { profile }                   = useAuth()
  const { tasks, refresh, setTasks }  = useApp()
  const [allTasks,  setAllTasks]      = useState([])  // includes inactive
  const [tab,       setTab]           = useState('tasks')
  const [editing,   setEditing]       = useState(null)
  const [creating,  setCreating]      = useState(false)
  const [deactivateId, setDeactivateId] = useState(null)  // soft: is_active=false
  const [hardDeleteId, setHardDeleteId] = useState(null)  // permanent removal
  const [busy,      setBusy]          = useState(false)
  const [toast,     setToast]         = useState('')
  const [settings,  setSettings]      = useState({ min_daily_points: '100', min_weekly_points: '300' })
  const [users,     setUsers]         = useState([])
  const [loading,   setLoading]       = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: taskData }, { data: settingsData }, { data: userData }] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('*').eq('id', 1).single(),
      supabase.from('profiles').select('*').order('created_at'),
    ])
    setAllTasks(taskData ?? [])
    if (settingsData) setSettings({
      min_daily_points:  String(settingsData.min_daily_points  ?? 100),
      min_weekly_points: String(settingsData.min_weekly_points ?? 300),
    })
    setUsers(userData ?? [])
    setLoading(false)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // ── Create task ───────────────────────────────────────────────
  async function handleCreate(form) {
    setBusy(true)
    const { error } = await supabase.from('tasks').insert({
      ...form,
      created_by: profile.id,
    })
    setBusy(false)
    if (error) { showToast('Error: ' + error.message); return }
    showToast('Task created!')
    setCreating(false)
    loadAll()
    refresh()
  }

  // ── Update task ───────────────────────────────────────────────
  async function handleUpdate(form) {
    setBusy(true)
    const { error } = await supabase
      .from('tasks')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', editing.id)
    setBusy(false)
    if (error) { showToast('Error: ' + error.message); return }
    showToast('Task updated!')
    setEditing(null)
    loadAll()
    refresh()
  }

  // ── Deactivate task (soft: set is_active = false) ─────────────
  async function handleDeactivate() {
    setBusy(true)
    await supabase
      .from('tasks')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', deactivateId)
    setBusy(false)
    setDeactivateId(null)
    showToast('Task deactivated.')
    loadAll()
    refresh()
  }

  // ── Reactivate task ───────────────────────────────────────────
  async function handleActivate(task) {
    await supabase
      .from('tasks')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', task.id)
    showToast('Task reactivated.')
    loadAll()
    refresh()
  }

  // ── Delete task permanently (hard: removes the row + its logs) ─
  async function handleHardDelete() {
    setBusy(true)
    const { error } = await supabase.from('tasks').delete().eq('id', hardDeleteId)
    setBusy(false)
    setHardDeleteId(null)
    if (error) { showToast('Error: ' + error.message); return }
    showToast('Task permanently deleted.')
    loadAll()
    refresh()
  }

  // ── Save settings ─────────────────────────────────────────────
  async function handleSaveSettings(e) {
    e.preventDefault()
    const pts  = parseInt(settings.min_daily_points,  10)
    const wpts = parseInt(settings.min_weekly_points, 10)
    if (!pts || pts < 1)   return alert('Minimum daily points must be at least 1.')
    if (!wpts || wpts < 1) return alert('Minimum weekly points must be at least 1.')
    setBusy(true)
    await supabase
      .from('app_settings')
      .update({ min_daily_points: pts, min_weekly_points: wpts, updated_at: new Date().toISOString() })
      .eq('id', 1)
    setBusy(false)
    showToast('Settings saved!')
    refresh()
  }

  // ── Toggle user role ──────────────────────────────────────────
  async function toggleRole(u) {
    if (u.id === profile.id) return  // can't demote yourself
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
    showToast(`${u.username} is now ${newRole}`)
    loadAll()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-ink-400 text-sm mt-1">Manage tasks, settings and users</p>
      </div>

      {/* Tabs */}
      <div className="segmented">
        {['tasks', 'settings', 'users'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`segmented-item ${tab === t ? 'segmented-item-active' : ''}`}
          >
            {t === 'tasks'    && `Tasks (${allTasks.length})`}
            {t === 'settings' && 'Settings'}
            {t === 'users'    && `Users (${users.length})`}
          </button>
        ))}
      </div>

      {/* ── Tasks tab ──────────────────────────────────────────── */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => { setCreating(true); setEditing(null) }}>
              <Plus size={16} /> New task
            </button>
          </div>

          {/* Create form */}
          {creating && (
            <div className="card border-accent-700/50 ring-1 ring-accent-500/10">
              <h3 className="font-semibold mb-4 text-accent-700">New task</h3>
              <TaskForm
                onSubmit={handleCreate}
                onCancel={() => setCreating(false)}
                busy={busy}
              />
            </div>
          )}

          {/* Task list */}
          <div className="space-y-3">
            {allTasks.map((task) => (
              <div key={task.id}>
                {editing?.id === task.id ? (
                  <div className="card border-amber-700/60">
                    <h3 className="font-bold mb-4 text-amber-700">Edit Task</h3>
                    <TaskForm
                      initial={task}
                      onSubmit={handleUpdate}
                      onCancel={() => setEditing(null)}
                      busy={busy}
                    />
                  </div>
                ) : (
                  <AdminTaskRow
                    task={task}
                    onEdit={() => { setEditing(task); setCreating(false) }}
                    onToggleActive={() => task.is_active ? setDeactivateId(task.id) : handleActivate(task)}
                    onDelete={() => setHardDeleteId(task.id)}
                  />
                )}
              </div>
            ))}
            {allTasks.length === 0 && (
              <div className="card flex flex-col items-center text-center py-12">
                <div className="w-12 h-12 rounded-xl bg-ink-800 flex items-center justify-center mb-3">
                  <Inbox size={22} className="text-ink-500" />
                </div>
                <p className="text-sm text-ink-400">No tasks yet. Create one above.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Settings tab ────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="card max-w-md">
          <h2 className="font-semibold mb-1">App settings</h2>
          <p className="text-xs text-ink-500 mb-5">Completion thresholds for all users</p>
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label className="label">Minimum daily points</label>
              <p className="hint mb-2 mt-0">
                Points needed to complete a day.
              </p>
              <input
                className="input"
                type="number"
                min={1}
                value={settings.min_daily_points}
                placeholder="100"
                onChange={(e) => setSettings({ ...settings, min_daily_points: e.target.value })}
                onBlur={() => {
                  if (!settings.min_daily_points || settings.min_daily_points === '0')
                    setSettings((s) => ({ ...s, min_daily_points: '1' }))
                }}
                required
              />
            </div>
            <div>
              <label className="label">Minimum weekly points</label>
              <p className="hint mb-2 mt-0">
                Target for the weekly-tasks progress bar (Mon–Sun).
              </p>
              <input
                className="input"
                type="number"
                min={1}
                value={settings.min_weekly_points}
                placeholder="300"
                onChange={(e) => setSettings({ ...settings, min_weekly_points: e.target.value })}
                onBlur={() => {
                  if (!settings.min_weekly_points || settings.min_weekly_points === '0')
                    setSettings((s) => ({ ...s, min_weekly_points: '1' }))
                }}
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
          </form>
        </div>
      )}

      {/* ── Users tab ────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="card p-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-ink-800/60 transition-colors">
              <Link to={`/profile/${u.id}`} className="flex items-center gap-3 min-w-0 group">
                <Avatar username={u.username} avatarUrl={u.avatar_url} size={36} />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-ink-100 truncate group-hover:text-accent-700 transition-colors">{u.username}</p>
                  <p className="text-xs text-ink-500">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <span className={u.role === 'admin' ? 'badge-amber' : 'badge-gray'}>
                  {u.role}
                </span>
                <Link to={`/profile/${u.id}`} aria-label="View profile" title="View profile" className="icon-btn">
                  <UserCircle size={16} />
                </Link>
                {u.id !== profile.id && (
                  <button onClick={() => toggleRole(u)} className="btn-ghost btn-sm">
                    Toggle role
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deactivate confirm (soft) */}
      {deactivateId && (
        <ConfirmModal
          title="Deactivate Task"
          message="This task will be hidden from users but kept in the database. Historical logs are preserved and you can reactivate it later."
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateId(null)}
          danger
        />
      )}

      {/* Hard delete confirm (permanent) */}
      {hardDeleteId && (
        <ConfirmModal
          title="Permanently Delete Task"
          message="This removes the task and ALL of its logs and streaks for every user. This cannot be undone. To just hide it, use Deactivate instead."
          onConfirm={handleHardDelete}
          onCancel={() => setHardDeleteId(null)}
          danger
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink-100 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-elevated animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  )
}

function AdminTaskRow({ task, onEdit, onToggleActive, onDelete }) {
  return (
    <div className={`card card-interactive flex flex-col sm:flex-row sm:items-center gap-3 ${!task.is_active ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-ink-100">{task.title}</span>
          <span className={task.frequency === 'weekly' ? 'badge-blue' : 'badge-gray'}>
            {task.frequency ?? 'daily'}
          </span>
          <span className={task.type === 'one-time' ? 'badge-gray' : 'badge-purple'}>
            {task.type}
          </span>
          {task.type === 'one-time' && (
            <span className={task.recoverable ? 'badge-gray' : 'badge-amber'}>
              {task.recoverable ? 'recoverable' : 'required'}
            </span>
          )}
          {!task.is_active && <span className="badge-gray">inactive</span>}
        </div>
        {task.description && (
          <p className="text-xs text-ink-500 mt-1 truncate">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-500">
          <span className="text-accent-600 font-medium tabular-nums">+{task.points_per_action} pts</span>
          {task.type === 'continuous' && (
            <span>threshold: {task.daily_threshold} / {task.frequency === 'weekly' ? 'week' : 'day'}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onEdit} className="btn-secondary btn-sm">
          <Pencil size={13} /> Edit
        </button>
        <button onClick={onToggleActive} className="btn-ghost btn-sm">
          <Power size={13} /> {task.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button onClick={onDelete} className="btn-danger-ghost btn-sm">
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  )
}
