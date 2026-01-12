import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { fetchHistoryRecords } from '../lib/history.js'
import { useAuth } from '../state/AuthContext.jsx'

function formatDateInput(date) {
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function buildDefaultRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - 6)
  return {
    start: formatDateInput(start),
    end: formatDateInput(end),
  }
}

function History() {
  const { config, isAuthenticated, clearAuth } = useAuth()
  const navigate = useNavigate()
  const defaultRange = buildDefaultRange()
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [historyItems, setHistoryItems] = useState([])
  const [historySource, setHistorySource] = useState('')

  const loadHistory = async (start, end) => {
    if (!isAuthenticated) return
    setStatus({ type: 'loading', message: 'Loading history...' })
    const response = await fetchHistoryRecords(config, start, end)

    if (response.unauthorized) {
      clearAuth()
      navigate('/settings', { replace: true })
      return
    }

    if (!response.ok) {
      setStatus({ type: 'error', message: response.error || 'Failed to load history.' })
      return
    }

    setHistoryItems(response.data || [])
    setHistorySource(response.source || '')
    setStatus({ type: 'success', message: '' })
  }

  useEffect(() => {
    loadHistory(startDate, endDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, isAuthenticated])

  const handleSubmit = (event) => {
    event.preventDefault()
    loadHistory(startDate, endDate)
  }

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="page-title">Recent workouts</h1>
          {historySource ? (
            <p className="page-subtitle">Source: {historySource}</p>
          ) : (
            <p className="page-subtitle">Session records will appear here once synced.</p>
          )}
        </div>
        <form className="history-filters" onSubmit={handleSubmit}>
          <label>
            <span>Start</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            <span>End</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <button className="btn btn-outline" type="submit">
            Load
          </button>
        </form>
      </section>

      {status.type === 'loading' ? (
        <div className="notice notice-loading">{status.message}</div>
      ) : null}
      {status.type === 'error' ? (
        <div className="notice notice-error">{status.message}</div>
      ) : null}

      <section className="grid-2">
        {historyItems.length === 0 && status.type !== 'loading' ? (
          <div className="card">No workouts found.</div>
        ) : null}
        {historyItems.map((item) => (
          <div key={`${item.detail_id || item.title}-${item.performed_at || ''}`} className="card history-card">
            <div className="history-card-header">
              <h3>{item.title}</h3>
              {item.performed_at ? <span>{item.performed_at}</span> : null}
            </div>
            {item.device ? <div className="history-meta">Device: {item.device}</div> : null}
            {item.metrics?.length ? (
              <div className="history-metrics">
                {item.metrics.map((metric) => (
                  <div key={metric.label}>
                    {metric.label}: {metric.value}
                  </div>
                ))}
              </div>
            ) : null}
            {item.detail_id ? (
              <NavLink className="btn btn-ghost" to={`/history/${item.detail_id}`}>
                View details
              </NavLink>
            ) : null}
            <details className="history-raw">
              <summary>Raw payload</summary>
              <pre>{item.raw_json}</pre>
            </details>
          </div>
        ))}
      </section>
    </div>
  )
}

export default History
