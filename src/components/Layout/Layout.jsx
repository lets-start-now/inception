import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import LeaderPopup from '../Common/LeaderPopup'
import { fetchLeaderForDate } from '../../lib/taskLogic'
import { yesterday } from '../../lib/dateUtils'

export default function Layout({ children }) {
  const [leader, setLeader]       = useState(null)
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    const lastShown = localStorage.getItem('leader_popup_date')
    const todayStr  = new Date().toISOString().split('T')[0]
    if (lastShown === todayStr) return

    fetchLeaderForDate(yesterday()).then((data) => {
      if (data) {
        setLeader(data)
        setShowPopup(true)
        localStorage.setItem('leader_popup_date', todayStr)
      }
    })
  }, [])

  return (
    <div className="min-h-screen flex bg-ink-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileNav />

      {showPopup && leader && (
        <LeaderPopup leader={leader} onClose={() => setShowPopup(false)} />
      )}
    </div>
  )
}
