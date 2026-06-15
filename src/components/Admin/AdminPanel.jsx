import { useState, useEffect } from 'react'
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
  const [deleteId,  setDeleteId]      = useState(null)
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

  // ── Delete task (soft: set is_active = false) ─────────────────
  async function handleDelete() {
    setBusy(true)
    await supabase
      .from('tasks')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', deleteId)
    setBusy(false)
    setDeleteId(null)
    showToast('Task deactivated.')
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
        <h1 className="text-2xl font-black">Admin Panel</h1>
        <p className="text-gray-500 text-sm">Manage tasks, settings and users</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {['tasks', 'settings', 'users'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-amber-700/80 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
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
              + New Task
            </button>
          </div>

          {/* Create form */}
          {creating && (
            <div className="card border-brand-700/60">
              <h3 className="font-bold mb-4 text-brand-300">New Task</h3>
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
                    <h3 className="font-bold mb-4 text-amber-300">Edit Task</h3>
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
                    onDelete={() => setDeleteId(task.id)}
                  />
                )}
              </div>
            ))}
            {allTasks.length === 0 && (
              <div className="card text-center text-gray-500 py-10">
                No tasks yet. Create one above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Settings tab ────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="card max-w-md">
          <h2 className="font-bold mb-4">App Settings</h2>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="label">Minimum Daily Points</label>
              <p className="text-xs text-gray-500 mb-2">
                Users must earn this many points to complete a day.
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
              <label className="label">Minimum Weekly Points</label>
              <p className="text-xs text-gray-500 mb-2">
                Target for the separate weekly-tasks progress bar (Mon–Sun).
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
              {busy ? 'Saving…' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

      {/* ── Users tab ────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="card p-0 overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm font-bold">
                  {u.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{u.username}</p>
                  <p className="text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={u.role === 'admin' ? 'badge-amber' : 'badge-gray'}>
                  {u.role}
                </span>
                {u.id !== profile.id && (
                  <button
                    onClick={() => toggleRole(u)}
                    className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    Toggle role
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <ConfirmModal
          title="Deactivate Task"
          message="This task will be hidden from users. Historical logs are preserved."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
          danger
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  )
}

function AdminTaskRow({ task, onEdit, onDelete }) {
  return (
    <div className={`card flex items-center gap-3 ${!task.is_active ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{task.title}</span>
          <span className={task.frequency === 'weekly' ? 'badge-blue' : 'badge-gray'}>
            {task.frequency ?? 'daily'}
          </span>
          <span className={task.type === 'one-time' ? 'badge-gray' : 'badge-purple'}>
            {task.type}
          </span>
          {!task.is_active && <span className="badge-gray">inactive</span>}
        </div>
        {task.description && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span className="text-brand-400 font-mono">+{task.points_per_action} pts</span>
          {task.type === 'continuous' && (
            <span>threshold: {task.daily_threshold} / {task.frequency === 'weekly' ? 'week' : 'day'}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onEdit}
          className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-red-800 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
