import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Register() {
  const { signUp } = useAuth()
  const navigate   = useNavigate()
  const [form,  setForm]  = useState({ email: '', password: '', username: '' })
  const [error, setError] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [done,  setDone]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.username.length < 3) { setError('Username must be at least 3 characters'); return }
    setBusy(true)
    setError('')
    const { error } = await signUp(form.email, form.password, form.username)
    if (error) { setError(error.message); setBusy(false) }
    else setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-950">
        <div className="card max-w-sm w-full text-center">
          <div className="text-5xl mb-3">📬</div>
          <h2 className="text-xl font-bold mb-2">Check your email</h2>
          <p className="text-gray-400 text-sm mb-4">
            We've sent a confirmation link to <strong>{form.email}</strong>.
            Confirm and then sign in.
          </p>
          <Link to="/login" className="btn-primary block text-center">Go to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚡</div>
          <h1 className="text-3xl font-black text-white">HabitQuest</h1>
          <p className="text-gray-500 text-sm mt-1">Start your journey</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-xl font-bold">Create account</h2>

          {error && (
            <div className="bg-red-900/40 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="label">Username</label>
            <input
              className="input"
              type="text"
              placeholder="coolhero42"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="min. 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
          </div>

          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
