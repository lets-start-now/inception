import { Routes, Route, Navigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout/Layout'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import Dashboard from './components/Dashboard/Dashboard'
import TasksPage from './components/Tasks/TasksPage'
import Leaderboard from './components/Leaderboard/Leaderboard'
import ContributionGraph from './components/Graph/ContributionGraph'
import ProfilePage from './components/Profile/ProfilePage'
import AdminPanel from './components/Admin/AdminPanel'
import LoadingSpinner from './components/Common/LoadingSpinner'

function AppRoutes() {
  const { user, profile, loading, authError } = useAuth()

  if (authError && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950 p-6">
        <div className="max-w-md w-full card text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/12 border border-red-500/25 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
          <h1 className="text-lg font-semibold text-ink-100">Couldn&apos;t reach the server</h1>
          <p className="text-sm text-ink-400 mt-2 break-words">{authError}</p>
          <p className="text-xs text-ink-600 mt-3">
            Secure context: {String(window.isSecureContext)} · {window.location.origin}
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full mt-5">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner full />

  if (!user) {
    return (
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*"         element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <AppProvider>
      <Layout>
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/tasks"       element={<TasksPage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/graph"       element={<ContributionGraph />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          {profile?.role === 'admin' && (
            <Route path="/admin" element={<AdminPanel />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AppProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
