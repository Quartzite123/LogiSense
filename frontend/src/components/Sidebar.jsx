import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  BarsIcon,
  ChevronIcon,
  ClockIcon,
  GridIcon,
  LogoutIcon,
  PencilIcon,
  SlidersIcon,
  SparkIcon,
  TruckIcon,
} from './icons.jsx'

const NAV = [
  { to: '/', label: 'Landing', sub: 'Overview', Icon: GridIcon, end: true },
  { to: '/tat', label: 'TAT Analysis', sub: 'Delivered E+OT', Icon: ClockIcon },
  { to: '/transit', label: 'Transit', sub: 'In-flight', Icon: TruckIcon },
  { to: '/aggregate', label: 'Aggregate', sub: 'Company breakdown', Icon: BarsIcon },
  {
    to: '/aggregate-transit',
    label: 'Aggregate Transit',
    sub: 'Per-company in-flight',
    Icon: TruckIcon,
  },
  { to: '/customize', label: 'Customize', sub: 'Ad-hoc query', Icon: SlidersIcon },
  { to: '/edit', label: 'Edit', sub: 'Reference data', Icon: PencilIcon },
  { to: '/insights', label: 'AI Insights', sub: 'Patterns · Chat', Icon: SparkIcon },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  const signOut = () => {
    localStorage.removeItem('logi_auth')
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={`sidebar-desktop flex h-full shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 ${
        collapsed ? 'w-[64px]' : 'w-[240px]'
      }`}
    >
      {/* Brand + collapse toggle */}
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-lg font-semibold tracking-tight text-primary">
              LogiSense
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Logistics · Intelligence
            </span>
          </div>
        )}
        {collapsed && (
          <span className="mx-auto font-mono text-lg font-bold text-primary">LS</span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-md p-1.5 text-text-muted hover:bg-surface hover:text-text-primary"
        >
          <ChevronIcon
            className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="px-5 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
          Workspace
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map(({ to, label, sub, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
                collapsed ? 'justify-center' : '',
                isActive
                  ? 'text-text-primary'
                  : 'text-text-muted hover:bg-surface hover:text-text-primary',
              ].join(' ')
            }
            style={({ isActive }) => ({
              borderLeft: isActive ? '3px solid #B18AFF' : '3px solid transparent',
              background: isActive ? 'rgba(177, 138, 255,0.06)' : undefined,
            })}
          >
            <span className="shrink-0">
              <Icon />
            </span>
            {!collapsed && (
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-[11px] text-text-muted">{sub}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-border p-2">
        <button
          onClick={signOut}
          title="Sign out"
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-text-muted transition-colors hover:bg-surface hover:text-text-primary ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <span className="shrink-0">
            <LogoutIcon />
          </span>
          {!collapsed && <span className="text-sm font-medium">Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
