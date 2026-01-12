import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { fetchHistoryDetail } from '../lib/history.js'
import { useAuth } from '../state/AuthContext.jsx'

function HistoryDetail() {
  const { sessionId } = useParams()
  const { config, clearAuth } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [detail, setDetail] = useState(null)
  const [raw, setRaw] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadDetail = async () => {
      if (!sessionId) return
      setStatus({ type: 'loading', message: 'Loading details...' })
      const response = await fetchHistoryDetail(config, sessionId)
      if (!isMounted) return

      if (response.unauthorized) {
        clearAuth()
        navigate('/settings', { replace: true })
        return
      }

      if (!response.ok) {
        setStatus({ type: 'error', message: response.error || 'Failed to load details.' })
        return
      }

      setDetail(response.data)
      setRaw(response.raw)
      setStatus({ type: 'success', message: '' })
    }

    loadDetail()

    return () => {
      isMounted = false
    }
  }, [sessionId, config, clearAuth, navigate])

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Session detail</p>
          <h1 className="page-title">{detail?.title || `Session ${sessionId || '--'}`}</h1>
          <p className="page-subtitle">Training ID: {sessionId}</p>
        </div>
        <NavLink className="btn btn-outline" to="/history">
          Back to History
        </NavLink>
      </section>

      {status.type === 'loading' ? (
        <div className="notice notice-loading">{status.message}</div>
      ) : null}
      {status.type === 'error' ? (
        <div className="notice notice-error">{status.message}</div>
      ) : null}

      {detail ? (
        <>
          <section className="grid-2">
            <div className="card">
              <h2 className="section-title">Overview</h2>
              <div className="stack">
                {detail.start_time ? <div>Start: {detail.start_time}</div> : null}
                {detail.end_time ? <div>End: {detail.end_time}</div> : null}
                {detail.device ? <div>Device: {detail.device}</div> : null}
              </div>
              {detail.metrics?.length ? (
                <div className="stat-grid" style={{ marginTop: '16px' }}>
                  {detail.metrics.map((metric) => (
                    <div key={metric.label} className="stat">
                      <div className="stat-label">{metric.label}</div>
                      <div className="stat-value">{metric.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="card">
              <h2 className="section-title">Tips</h2>
              <p className="page-subtitle">
                Use the debug panel below to inspect the raw API response for this session.
              </p>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Exercises</h2>
            {detail.exercises?.length ? (
              <div className="stack">
                {detail.exercises.map((exercise) => (
                  <div key={exercise.name} className="history-exercise">
                    <div className="history-exercise-title">{exercise.name}</div>
                    {exercise.metrics?.length ? (
                      <div className="history-exercise-metrics">
                        {exercise.metrics.map((metric) => (
                          <div key={metric.label}>
                            {metric.label}: {metric.value}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="builder-muted">No metrics available.</div>
                    )}
                    {exercise.sets?.length ? (
                      <details className="history-sets">
                        <summary>Set details</summary>
                        <div className="history-sets-grid">
                          {exercise.sets.map((set, index) => (
                            <div key={`${exercise.name}-${index}`} className="history-set-card">
                              <div className="history-set-title">Set {set.index ?? index + 1}</div>
                              <div>Reps: {set.reps}</div>
                              {set.time ? <div>Time: {set.time}</div> : null}
                              {set.avg_weight ? <div>Avg Weight: {set.avg_weight}</div> : null}
                              {set.capacity ? <div>Volume: {set.capacity}</div> : null}
                              {set.weight_detail ? <div>Weight Range: {set.weight_detail}</div> : null}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="builder-muted">No exercise detail list found in the response.</div>
            )}
          </section>

          {raw ? (
            <details className="history-raw">
              <summary>Raw payload</summary>
              <pre>{JSON.stringify(raw, null, 2)}</pre>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default HistoryDetail
