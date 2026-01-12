import { NavLink } from 'react-router-dom'

const metrics = [
  { label: 'Workouts', value: '--', caption: 'Waiting on sync' },
  { label: 'Planned Sessions', value: '--', caption: 'Drag onto the calendar' },
  { label: 'Total Volume', value: '--', caption: 'Calculated per unit' },
]

const quickStart = [
  {
    title: 'Connect your account',
    detail: 'Add your session token in Settings to unlock sync.',
  },
  {
    title: 'Build a new plan',
    detail: 'Start from the Builder and assemble your set flow.',
  },
  {
    title: 'Schedule sessions',
    detail: 'Drop plans onto the calendar for quick planning.',
  },
]

const highlights = [
  {
    title: 'Local-first library',
    copy: 'Exercises, media, and filters live in your browser cache.',
  },
  {
    title: 'Calendar focus',
    copy: 'See the month at a glance and adjust with drag-and-drop.',
  },
  {
    title: 'Privacy by design',
    copy: 'No proprietary data is persisted on our servers.',
  },
]

function Dashboard() {
  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="hero-title">Shape your next training block.</h1>
          <p className="hero-subtitle">
            Organize plans, schedule sessions, and keep everything local to your device.
          </p>
          <div className="hero-actions">
            <NavLink className="btn btn-primary" to="/create">
              Start a plan
            </NavLink>
            <NavLink className="btn btn-ghost" to="/history">
              View history
            </NavLink>
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-card-header">
            <span className="tag">Monthly view</span>
            <span className="tag tag-muted">Offline-ready</span>
          </div>
          <div className="hero-card-body">
            <div className="calendar-preview">
              <div className="calendar-week">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {Array.from({ length: 14 }).map((_, index) => (
                  <div key={index} className="calendar-cell">
                    <span>{index + 1}</span>
                    {index % 5 === 0 ? <span className="calendar-dot" /> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="hero-card-footer">
              Drag workouts to schedule and keep your week balanced.
            </div>
          </div>
        </div>
      </section>

      <section className="grid-3 stagger">
        {metrics.map((item) => (
          <div key={item.label} className="card stat">
            <div className="stat-label">{item.label}</div>
            <div className="stat-value">{item.value}</div>
            <div className="stat-caption">{item.caption}</div>
          </div>
        ))}
      </section>

      <section className="grid-2">
        <div className="card">
          <h2 className="section-title">Quick start</h2>
          <div className="stack">
            {quickStart.map((item) => (
              <div key={item.title} className="list-row">
                <div>
                  <div className="list-title">{item.title}</div>
                  <div className="list-detail">{item.detail}</div>
                </div>
                <button className="btn btn-outline" type="button">Open</button>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="section-title">Focus highlights</h2>
          <div className="stack">
            {highlights.map((item) => (
              <div key={item.title} className="highlight">
                <div className="highlight-title">{item.title}</div>
                <div className="highlight-copy">{item.copy}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
