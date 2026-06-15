import { useState, useEffect } from 'react'
import Navbar from './Navbar'
import LeaderPopup from '../Common/LeaderPopup'
import { fetchLeaderForDate } from '../../lib/taskLogic'
import { yesterday } from '../../lib/dateUtils'

export default function Layout({ children }) {
  const [leader, setLeader]           = useState(null)
  const [showPopup, setShowPopup]     = useState(false)

  useEffect(() => {
    const lastShown = localStorage.getItem('leader_popup_date')
    const todayStr  = new Date().toISOString().split('T')[0]

    if (lastShown === todayStr) return  // already shown today

    fetchLeaderForDate(yesterday()).then((data) => {
      if (data) {
        setLeader(data)
        setShowPopup(true)
        localStorage.setItem('leader_popup_date', todayStr)
      }
    })
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>
      {showPopup && leader && (
        <LeaderPopup leader={leader} onClose={() => setShowPopup(false)} />
      )}
    </div>
  )
}
