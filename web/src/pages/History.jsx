import { NavLink } from 'react-router-dom'

const historyItems = [
  {
    id: '2025-10-18',
    title: 'Upper focus',
    detail: '45 min - Strength emphasis',
  },
  {
    id: '2025-10-15',
    title: 'Lower split',
    detail: '50 min - Lower body',
  },
  {
    id: '2025-10-12',
    title: 'Core + mobility',
    detail: '35 min - Recovery',
  },
]

function History() {
  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="page-title">Review past sessions.</h1>
          <p className="page-subtitle">Session records will appear here once synced.</p>
        </div>
        <button className="btn btn-outline" type="button">Export</button>
      </section>

      <section className="stack">
        {historyItems.map((item) => (
          <div key={item.id} className="card list-row">
            <div>
              <div className="list-title">{item.title}</div>
              <div className="list-detail">{item.detail}</div>
            </div>
            <NavLink className="btn btn-ghost" to={`/history/${item.id}`}>
              View
            </NavLink>
          </div>
        ))}
      </section>
    </div>
  )
}

export default History
