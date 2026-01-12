import { NavLink, useParams } from 'react-router-dom'

const mockBlocks = [
  { label: 'Warm-up', detail: 'Mobility flow, 8 min' },
  { label: 'Main set', detail: '4 exercises, 32 min' },
  { label: 'Cool down', detail: 'Stretch, 6 min' },
]

function HistoryDetail() {
  const { sessionId } = useParams()

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Session detail</p>
          <h1 className="page-title">Session {sessionId || '--'}</h1>
          <p className="page-subtitle">Detailed metrics and notes will populate after sync.</p>
        </div>
        <NavLink className="btn btn-outline" to="/history">
          Back to history
        </NavLink>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2 className="section-title">Overview</h2>
          <div className="stack">
            {mockBlocks.map((block) => (
              <div key={block.label} className="highlight">
                <div className="highlight-title">{block.label}</div>
                <div className="highlight-copy">{block.detail}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="section-title">Metrics</h2>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-label">Duration</div>
              <div className="stat-value">--</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total volume</div>
              <div className="stat-value">--</div>
            </div>
            <div className="stat">
              <div className="stat-label">Intensity</div>
              <div className="stat-value">--</div>
            </div>
            <div className="stat">
              <div className="stat-label">Focus</div>
              <div className="stat-value">--</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HistoryDetail
