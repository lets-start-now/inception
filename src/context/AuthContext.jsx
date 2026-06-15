import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Reject if a promise takes longer than `ms` — prevents the app from hanging
// forever on a stalled network/auth call (the "infinite spinner" symptom).
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)   // Supabase auth user
  const [profile,   setProfile]   = useState(null)   // public.profiles row
  const [loading,   setLoading]   = useState(true)
  const [authError, setAuthError] = useState(null)   // surfaced on screen

  // Id of the user whose profile is already loaded. Used to ignore the
  // repeated SIGNED_IN / TOKEN_REFRESHED events Supabase fires on every tab
  // focus — those must NOT re-trigger loading or a profile refetch.
  const loadedUserId = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Fail fast if the client was created without credentials.
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setAuthError('Supabase credentials are missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
        setLoading(false)
        return
      }

      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'getSession()'
        )
        if (cancelled) return
        if (error) throw error

        const session = data?.session
        setUser(session?.user ?? null)
        if (session?.user) await loadProfile(session.user.id)
        else setLoading(false)
      } catch (e) {
        if (cancelled) return
        console.error('Auth init failed:', e)
        setAuthError(e.message ?? String(e))
        setLoading(false)
      }
    }

    init()

    // Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null

      if (!nextUser) {
        setUser(null)
        setProfile(null)
        loadedUserId.current = null
        setLoading(false)
        return
      }

      // Keep a stable user object identity when the id hasn't changed, so
      // downstream effects (AppContext data fetch) don't re-run on refresh.
      setUser((prev) => (prev && prev.id === nextUser.id ? prev : nextUser))

      // Only (re)load the profile for a genuinely new user — ignore the
      // token-refresh re-fires that happen on tab focus.
      if (loadedUserId.current !== nextUser.id) loadProfile(nextUser.id)
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  async function loadProfile(userId) {
    loadedUserId.current = userId   // set early so concurrent events dedupe
    setLoading(true)
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        8000,
        'load profile'
      )
      if (error) throw error
      setProfile(data)
    } catch (e) {
      console.error('loadProfile failed:', e)
      setAuthError(e.message ?? String(e))
      loadedUserId.current = null   // allow a retry on the next event
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (!error && data.user) {
      // Manually insert profile in case trigger hasn't fired yet
      await supabase.from('profiles').upsert({ id: data.user.id, username }, { onConflict: 'id' })
    }
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, authError, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
