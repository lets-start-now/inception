import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Supabase env vars missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
}

export const supabase = createClient(url || '', key || '', {
  auth: {
    // The default auth client guards getSession() with the Web Locks API
    // (navigator.locks), which is only reliable in a secure context
    // (https or localhost). When the app is opened over plain HTTP on a
    // LAN IP — e.g. from a phone at http://<your-ip>:5173 — that lock never
    // resolves and the app hangs on an infinite loading spinner.
    // A simple pass-through lock removes that dependency. Safe for a
    // single tab per device.
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
})
