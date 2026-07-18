import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Routes, Route } from 'react-router-dom'
import { UIProvider } from './context/ui.jsx'
import Sidebar from './components/Sidebar.jsx'
import MobileNav from './components/MobileNav.jsx'
import Login from './pages/Login.jsx'
import Landing from './pages/Landing.jsx'
import TAT from './pages/TAT.jsx'
import Transit from './pages/Transit.jsx'
import Aggregate from './pages/Aggregate.jsx'
import AggregateTransit from './pages/AggregateTransit.jsx'
import Customize from './pages/Customize.jsx'
import Edit from './pages/Edit.jsx'

// Insights is code-split — it pulls in the chat + pattern components lazily.
const Insights = lazy(() => import('./pages/Insights.jsx'))

function Placeholder({ title }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">This section ships in Phase 3.</p>
      </div>
    </div>
  )
}

// Layout route: gate on the demo-auth flag, otherwise render the dashboard chrome
// (sidebar + mobile nav) around the matched page via <Outlet />.
function ProtectedShell() {
  if (localStorage.getItem('logi_auth') !== 'true') {
    return <Navigate to="/login" replace />
  }
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-text-primary">
      <Sidebar />
      <main className="main-content flex-1 overflow-y-auto">
        <Suspense fallback={<div className="p-10 text-sm text-text-muted">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
      <MobileNav />
    </div>
  )
}

export default function App() {
  return (
    <UIProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Landing />} />
          <Route path="/tat" element={<TAT />} />
          <Route path="/transit" element={<Transit />} />
          <Route path="/aggregate" element={<Aggregate />} />
          <Route path="/aggregate-transit" element={<AggregateTransit />} />
          <Route path="/customize" element={<Customize />} />
          <Route path="/edit" element={<Edit />} />
          <Route path="/insights" element={<Insights />} />
          {/* Old AI Assistant route → keep bookmarks working, redirect to Insights. */}
          <Route path="/assistant" element={<Navigate to="/insights" replace />} />
          <Route path="*" element={<Placeholder title="Not found" />} />
        </Route>
      </Routes>
    </UIProvider>
  )
}
