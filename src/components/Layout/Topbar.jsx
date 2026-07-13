import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Zap, LogOut, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { titleForPath } from './nav'
import Avatar from '../Common/Avatar'

export default function Topbar() {
  const { totalPoints, minPoints, dayCompleted } = useApp()
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const pct = Math.min(100, Math.round((totalPoints / Math.max(1, minPoints)) * 100))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-ink-800 bg-ink-950/80 backdrop-blur-xl">
      <div className="h-full px-4 sm:px-6 flex items-center gap-4">
        {/* Mobile brand */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center">
            <Zap size={17} className="text-white" fill="currentColor" />
          </div>
          <span className="font-bold text-[15px] tracking-tight">HabitQuest</span>
        </div>

        {/* Desktop page title */}
        <h1 className="hidden lg:block text-lg font-semibold text-ink-100">{titleForPath(pathname)}</h1>

        <div className="ml-auto flex items-center gap-3">
          {/* Daily progress */}
          <div className="hidden sm:flex items-center gap-2.5 pl-3.5 pr-3.5 py-1.5 rounded-full bg-ink-900 border border-ink-800">
            <span className="text-xs font-medium text-ink-400">Today</span>
            <div className="track h-1.5 w-24">
              <div
                className={`h-full rounded-full transition-all duration-500 ${dayCompleted ? 'bg-emerald-500' : 'bg-accent-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums text-ink-200">{totalPoints}/{minPoints}</span>
            {dayCompleted && <Check size={14} className="text-emerald-600" strokeWidth={3} />}
          </div>

          {/* Mobile user + sign out */}
          <div className="flex lg:hidden items-center gap-2">
            <Link to={profile ? `/profile/${profile.id}` : '#'} aria-label="View your profile">
              <Avatar username={profile?.username} avatarUrl={profile?.avatar_url} size={32} />
            </Link>
            <button onClick={handleSignOut} aria-label="Sign out" className="icon-btn hover:text-red-600">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
