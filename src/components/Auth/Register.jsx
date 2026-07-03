import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, User, Mail, Lock, MailCheck, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import FormError from '../Common/FormError'

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
      <div className="min-h-screen flex items-center justify-center px-4 bg-ink-950">
        <div className="card max-w-sm w-full text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
            <MailCheck size={26} className="text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Check your email</h2>
          <p className="text-ink-400 text-sm mb-6 leading-relaxed">
            We&apos;ve sent a confirmation link to <span className="text-ink-200 font-medium">{form.email}</span>. Confirm it, then sign in.
          </p>
          <Link to="/login" className="btn-primary w-full">Go to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-ink-950 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[620px] h-[320px] bg-accent-600/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-600 mx-auto flex items-center justify-center shadow-[0_6px_24px_-6px_rgba(59,130,246,0.7)] mb-4">
            <Zap size={24} className="text-white" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-ink-400 text-sm mt-1.5">Start building better habits today</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <FormError message={error} />

          <div>
            <label className="label" htmlFor="username">Username</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
              <input
                id="username"
                className="input pl-10"
                type="text"
                placeholder="yourname"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="email">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
              <input
                id="email"
                className="input pl-10"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
              <input
                id="password"
                className="input pl-10"
                type="password"
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                required
              />
            </div>
          </div>

          <button className="btn-primary w-full mt-1" type="submit" disabled={busy}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-ink-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-600 font-medium hover:text-accent-700 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
