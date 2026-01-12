import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/library', label: 'Library' },
  { to: '/history', label: 'History' },
  { to: '/create', label: 'Builder' },
  { to: '/settings', label: 'Settings' },
]

function AppShell() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace />
  }

  return (
    <div className="app">
      <div className="announcement">
        <span className="announcement-pill">Local-first</span>
        <span className="announcement-text">Your training data stays in this browser by default.</span>
      </div>

      <header className="app-header">
        <div className="container header-content">
          <div className="brand">
            <div className="brand-mark">WM</div>
            <div>
              <div className="brand-title">Workout Manager</div>
              <div className="brand-subtitle">Plan, schedule, and refine sessions without the noise.</div>
            </div>
          </div>

          <nav className="nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <NavLink to="/create" className="btn btn-primary">
              New Plan
            </NavLink>
            <NavLink to="/settings" className="btn btn-outline">
              {isAuthenticated ? 'Connected' : 'Connect'}
            </NavLink>
          </div>
        </div>
      </header>

      <main className="app-main container">
        <Outlet />
      </main>

      <footer className="app-footer container">
        <div>
          Built for local use, offline-ready caching, and flexible scheduling.
        </div>
        <div className="footer-links">
          <span>Version: in-progress</span>
          <span className="dot">|</span>
          <span>Netlify target</span>
        </div>
      </footer>
    </div>
  )
}

export default AppShell
