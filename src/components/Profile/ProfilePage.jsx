import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Trophy, Medal, CheckCircle2, Crown, Brain, Flame,
  Shield, CalendarDays, UserX, Sparkles, Camera, Loader2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { fetchUserStreaks } from '../../lib/streakLogic'
import { daysBetween } from '../../lib/dateUtils'
import { uploadAvatar } from '../../lib/avatarUpload'
import StatCard from '../Common/StatCard'
import StreakList from '../Common/StreakList'
import LoadingSpinner from '../Common/LoadingSpinner'
import Avatar from '../Common/Avatar'
import ContributionCalendar from '../Graph/ContributionCalendar'

const POINTS_PER_LEVEL = 500

// Longest run of consecutive CALENDAR days with is_day_completed = true,
// across a user's whole history — not a per-task streak. A day with no
// daily_summaries row (no activity logged) has no entry in the set below,
// so it correctly breaks the streak like any other missed day.
function longestCompletionStreak(rows) {
  const completedDays = [...new Set(rows.filter((r) => r.is_day_completed).map((r) => r.summary_date))].sort()
  if (completedDays.length === 0) return 0
  let best = 1, current = 1
  for (let i = 1; i < completedDays.length; i++) {
    current = daysBetween(completedDays[i], completedDays[i - 1]) === 1 ? current + 1 : 1
    best = Math.max(best, current)
  }
  return best
}

export default function ProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { profile: myProfile, patchProfile } = useAuth()
  const fileInputRef = useRef(null)

  const [target,   setTarget]   = useState(null)
  const [streaks,  setStreaks]  = useState([])
  const [stats,    setStats]    = useState({ total: 0, completed: 0, leader: 0 })
  const [rank,     setRank]     = useState(null)
  const [totalUsers, setTotalUsers] = useState(null)
  const [bestStreak, setBestStreak] = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [uploadError,  setUploadError]  = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      const [{ data: targetProfile }, streaksData, { data: allSummaries }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        fetchUserStreaks(userId),
        supabase.from('daily_summaries').select('user_id, summary_date, total_points, is_day_completed, is_leader'),
      ])
      if (cancelled) return

      if (!targetProfile) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const agg = {}
      for (const row of allSummaries ?? []) {
        const a = agg[row.user_id] ?? (agg[row.user_id] = { total: 0, completed: 0, leader: 0 })
        a.total += row.total_points
        if (row.is_day_completed) a.completed++
        if (row.is_leader) a.leader++
      }
      const ranked = Object.entries(agg).sort((a, b) => b[1].total - a[1].total)
      const myRank = ranked.findIndex(([uid]) => uid === userId)

      setTarget(targetProfile)
      setStreaks(streaksData)
      setStats(agg[userId] ?? { total: 0, completed: 0, leader: 0 })
      setRank(myRank >= 0 ? myRank + 1 : null)
      setTotalUsers(ranked.length)
      setBestStreak(longestCompletionStreak((allSummaries ?? []).filter((r) => r.user_id === userId)))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''  // allow re-selecting the same file later
    if (!file) return

    setUploading(true)
    setUploadError('')
    try {
      const avatarUrl = await uploadAvatar(userId, file)
      setTarget((t) => ({ ...t, avatar_url: avatarUrl }))
      if (isMe) patchProfile({ avatar_url: avatarUrl })
    } catch (err) {
      setUploadError(err.message ?? 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <ProfileSkeleton />

  if (notFound) {
    return (
      <div className="card flex flex-col items-center text-center py-16 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-ink-800 flex items-center justify-center mb-4">
          <UserX size={26} className="text-ink-500" />
        </div>
        <p className="font-semibold text-ink-200">User not found</p>
        <p className="text-ink-500 text-sm mt-1">This profile doesn&apos;t exist or was removed.</p>
        <button onClick={() => navigate(-1)} className="btn-secondary mt-5">
          <ArrowLeft size={15} /> Go back
        </button>
      </div>
    )
  }

  const isMe        = myProfile?.id === userId
  const habitsCount = streaks.filter((s) => s.is_habit).length
  const level       = Math.floor(stats.total / POINTS_PER_LEVEL) + 1
  const levelPct    = Math.round(((stats.total % POINTS_PER_LEVEL) / POINTS_PER_LEVEL) * 100)
  const joined      = target.created_at
    ? new Date(target.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate(-1)} className="icon-btn -ml-1.5">
        <ArrowLeft size={18} />
      </button>

      {/* Profile header */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar username={target.username} avatarUrl={target.avatar_url} size={56} square />
            {isMe && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change profile picture"
                  title="Change profile picture"
                  className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-ink-900 border-2 border-ink-950 shadow-soft flex items-center justify-center text-ink-500 hover:text-accent-600 transition-colors disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-ink-100 truncate">{target.username}</h1>
              {isMe && <span className="badge-gray">You</span>}
              {target.role === 'admin' && <span className="badge-amber"><Shield size={11} /> Admin</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-ink-500 flex-wrap">
              {joined && (
                <span className="flex items-center gap-1">
                  <CalendarDays size={12} /> Joined {joined}
                </span>
              )}
              {rank && (
                <span className="flex items-center gap-1">
                  <Medal size={12} /> Rank #{rank} of {totalUsers}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Level progress — integrated footer, not a separate floating block */}
        <div className="mt-4 pt-4 border-t border-ink-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 font-semibold text-accent-600">
              <Sparkles size={13} /> Level {level}
            </span>
            <span className="text-ink-500">{POINTS_PER_LEVEL - (stats.total % POINTS_PER_LEVEL)} pts to level {level + 1}</span>
          </div>
          <div className="track h-1.5">
            <div className="h-full rounded-full bg-accent-500 transition-all duration-500" style={{ width: `${levelPct}%` }} />
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 text-red-700 text-sm rounded-xl px-3.5 py-2.5">
          {uploadError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={Trophy}       tint="accent"  value={stats.total.toLocaleString()} label="Total points" />
        <StatCard icon={CheckCircle2} tint="emerald" value={stats.completed}              label="Days completed" />
        <StatCard icon={Crown}        tint="amber"   value={stats.leader}                 label="Leader days" />
        <StatCard icon={Brain}        tint="violet"  value={habitsCount}                  label="Habits" />
        <StatCard icon={Flame}        tint="amber"   value={`${bestStreak}d`}              label="Best streak" />
        <StatCard icon={Medal}        tint="accent"  value={rank ? `#${rank}` : '—'}       label="All-time rank" />
      </div>

      <StreakList
        streaks={streaks}
        subtitle={isMe ? 'Your active momentum' : `${target.username}'s active momentum`}
      />

      {/* Activity calendar */}
      <div>
        <h2 className="font-semibold mb-3">Activity</h2>
        <ContributionCalendar userId={userId} showStats={false} />
      </div>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-9 w-9 rounded-lg" />
      <div className="skeleton h-28 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
      <div className="skeleton h-48 rounded-2xl" />
    </div>
  )
}
