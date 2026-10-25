import { Navigate, Route, Routes } from 'react-router'
import { Loader2, ServerCrash } from 'lucide-react'
import { useBootstrap } from './lib/api'
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

export function App() {
  const { isLoading, isError, refetch } = useBootstrap()

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin text-violet-500" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <EmptyState
          icon={<ServerCrash className="size-6" />}
          title="Can't reach the server"
          message="Make sure the API is running, then try again."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    )
  }

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
