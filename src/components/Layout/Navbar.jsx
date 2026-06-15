import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'

const navItems = [
  { to: '/',            label: 'Dashboard', icon: '🏠' },
  { to: '/tasks',       label: 'Tasks',     icon: '✅' },
  { to: '/leaderboard', label: 'Ranking',   icon: '🏆' },
  { to: '/graph',       label: 'Graph',     icon: '📊' },
]

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const { totalPoints, dayCompleted, minPoints } = useApp()
  const navigate = useNavigate()

  const pct = Math.min(100, Math.round((totalPoints / minPoints) * 100))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="bg-gray-900/80 backdrop-blur border-b border-gray-800 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <span className="text-brand-400 font-black text-lg tracking-tight shrink-0">
          ⚡ HabitQuest
        </span>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-1 flex-1">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-700/60 text-brand-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              <span>{icon}</span> {label}
            </NavLink>
          ))}
          {profile?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-700/60 text-amber-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              ⚙️ Admin
            </NavLink>
          )}
        </nav>

        {/* Daily progress bar */}
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-400 shrink-0">
          <span>{totalPoints} / {minPoints} pts</span>
          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${dayCompleted ? 'bg-green-500' : 'bg-brand-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {dayCompleted && <span className="text-green-400 font-semibold">✓</span>}
        </div>

        {/* User */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="text-xs text-gray-400 hidden sm:block">
            {profile?.username}
            {profile?.role === 'admin' && (
              <span className="ml-1 text-amber-400 text-[10px] font-bold uppercase">admin</span>
            )}
          </span>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden flex border-t border-gray-800">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-[10px] gap-0.5 transition-colors ${
                isActive ? 'text-brand-400' : 'text-gray-500'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
        {profile?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-[10px] gap-0.5 transition-colors ${
                isActive ? 'text-amber-400' : 'text-gray-500'
              }`
            }
          >
            <span className="text-base">⚙️</span>
            Admin
          </NavLink>
        )}
      </div>
    </header>
  )
}
