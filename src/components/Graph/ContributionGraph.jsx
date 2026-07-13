import { useAuth } from '../../context/AuthContext'
import ContributionCalendar from './ContributionCalendar'

export default function ContributionGraph() {
  const { profile } = useAuth()

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-ink-400 text-sm mt-1">Your consistency over the last 365 days</p>
      </div>

      {profile && <ContributionCalendar userId={profile.id} />}
    </div>
  )
}
