import { Routes, Route } from 'react-router-dom'
import { UIProvider } from './context/ui.jsx'
import Sidebar from './components/Sidebar.jsx'
import Landing from './pages/Landing.jsx'
import TAT from './pages/TAT.jsx'
import Transit from './pages/Transit.jsx'
import Aggregate from './pages/Aggregate.jsx'
import AggregateTransit from './pages/AggregateTransit.jsx'
import Customize from './pages/Customize.jsx'
import Edit from './pages/Edit.jsx'

// Placeholder for the AI Assistant (Phase 3).
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

export default function App() {
  return (
    <UIProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-text-primary">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/tat" element={<TAT />} />
            <Route path="/transit" element={<Transit />} />
            <Route path="/aggregate" element={<Aggregate />} />
            <Route path="/aggregate-transit" element={<AggregateTransit />} />
            <Route path="/customize" element={<Customize />} />
            <Route path="/edit" element={<Edit />} />
            <Route path="/assistant" element={<Placeholder title="AI Assistant" />} />
            <Route path="*" element={<Placeholder title="Not found" />} />
          </Routes>
        </main>
      </div>
    </UIProvider>
  )
}
