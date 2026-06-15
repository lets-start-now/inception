import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout/Layout'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import Dashboard from './components/Dashboard/Dashboard'
import TasksPage from './components/Tasks/TasksPage'
import Leaderboard from './components/Leaderboard/Leaderboard'
import ContributionGraph from './components/Graph/ContributionGraph'
import AdminPanel from './components/Admin/AdminPanel'
import LoadingSpinner from './components/Common/LoadingSpinner'

function AppRoutes() {
  const { user, profile, loading, authError } = useAuth()

  if (authError && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6">
        <div className="max-w-md w-full bg-gray-900 border border-red-800 rounded-2xl p-6 text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold text-red-300">Couldn’t reach the server</h1>
          <p className="text-sm text-gray-400 break-words">{authError}</p>
          <p className="text-xs text-gray-600">
            Secure context: {String(window.isSecureContext)} · URL: {window.location.origin}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 rounded-lg bg-brand-700 hover:bg-brand-600 text-white text-sm font-semibold"
          >
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
