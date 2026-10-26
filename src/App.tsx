import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, ServerCrash } from 'lucide-react'
import { useAuthStatus, useBootstrap } from './lib/api'
import { LockScreen } from './components/LockScreen'
import { Layout } from './components/Layout'
import { Button } from './components/ui/Button'
import { EmptyState } from './components/ui/Misc'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Budgets } from './pages/Budgets'
import { Accounts } from './pages/Accounts'
import { Categories } from './pages/Categories'
import { Notes } from './pages/Notes'
import { Stocks } from './pages/Stocks'
import { SettingsPage } from './pages/Settings'

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="size-6 animate-spin text-violet-500" />
    </div>
  )
}

function Unreachable({ retry }: { retry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <EmptyState
        icon={<ServerCrash className="size-6" />}
        title="Can't reach the server"
        message="Make sure the API is running, then try again."
        action={<Button onClick={retry}>Retry</Button>}
      />
    </div>
  )
}

export function App() {
  const qc = useQueryClient()
  const { data: auth, isLoading, isError, refetch } = useAuthStatus()

  useEffect(() => {
    const onExpired = () => qc.invalidateQueries({ queryKey: ['auth'] })
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [qc])

  if (isLoading) return <Loading />
  if (isError || !auth) return <Unreachable retry={() => refetch()} />
  if (!auth.configured) return <LockScreen mode="setup" />
  if (!auth.authenticated) return <LockScreen mode="login" />
  return <MainApp />
}

function MainApp() {
  const { isLoading, isError, error, refetch } = useBootstrap()

  if (isLoading || error?.message === 'Unauthorized') return <Loading />
  if (isError) return <Unreachable retry={() => refetch()} />

  return (
    <Layout>
      {(location) => (
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </Layout>
  )
}
