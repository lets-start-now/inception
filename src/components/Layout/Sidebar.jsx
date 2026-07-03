import { NavLink, useNavigate } from 'react-router-dom'
import { Zap, Shield, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { navItems } from './nav'

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    `group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-accent-500/12 text-accent-700'
        : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'
    }`

  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-ink-800 bg-ink-900 h-screen sticky top-0">
      {/* Brand */}
      <div className="h-16 flex items-center gap-2.5 px-6 border-b border-ink-800">
        <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center shadow-[0_2px_10px_-2px_rgba(59,130,246,0.6)]">
          <Zap size={18} className="text-white" fill="currentColor" />
        </div>
        <span className="font-bold text-[15px] tracking-tight">HabitQuest</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Menu</p>
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon size={18} className="shrink-0" strokeWidth={2} />
            {label}
          </NavLink>
        ))}

        {profile?.role === 'admin' && (
          <>
            <p className="px-3 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Admin</p>
            <NavLink to="/admin" className={linkClass}>
              <Shield size={18} className="shrink-0" strokeWidth={2} />
              Admin Panel
            </NavLink>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-ink-800">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-ink-800 transition-colors">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center text-sm font-semibold text-white shrink-0">
            {profile?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-100 truncate">{profile?.username}</p>
            <p className="text-xs text-ink-500 capitalize">{profile?.role ?? 'user'}</p>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="icon-btn hover:text-red-600"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
