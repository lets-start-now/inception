import { NavLink } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { navItems } from './nav'

export default function MobileNav() {
  const { profile } = useAuth()

  const items = [...navItems]
  if (profile?.role === 'admin') items.push({ to: '/admin', label: 'Admin', icon: Shield })

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-ink-800 bg-ink-950/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-accent-600' : 'text-ink-500 hover:text-ink-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
