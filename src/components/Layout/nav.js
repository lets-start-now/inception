import { LayoutDashboard, ListChecks, Trophy, Activity } from 'lucide-react'

export const navItems = [
  { to: '/',            label: 'Dashboard',   icon: LayoutDashboard, end: true },
  { to: '/tasks',       label: 'Tasks',       icon: ListChecks },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/graph',       label: 'Activity',    icon: Activity },
]

// Map a pathname to a human page title for the top bar.
export const titleForPath = (pathname) => {
  if (pathname.startsWith('/tasks'))       return 'Tasks'
  if (pathname.startsWith('/leaderboard')) return 'Leaderboard'
  if (pathname.startsWith('/graph'))       return 'Activity'
  if (pathname.startsWith('/admin'))       return 'Admin'
  return 'Dashboard'
}
