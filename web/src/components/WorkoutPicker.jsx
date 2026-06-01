import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteWorkout, fetchWorkouts } from '../lib/workouts.js'
import { useAuth } from '../state/AuthContext.jsx'

function WorkoutPicker({ onNewWorkout }) {
  const { config, isAuthenticated, clearAuth } = useAuth()
  const [workouts, setWorkouts] = useState([])
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [search, setSearch] = useState('')

  useEffect(() => {
    let isMounted = true
    if (!isAuthenticated) return
    setStatus({ type: 'loading', message: 'Loading workouts...' })
    fetchWorkouts(config).then((response) => {
      if (!isMounted) return
      if (response.unauthorized) { clearAuth(); return }
      if (!response.ok) {
        setStatus({ type: 'error', message: response.error || 'Failed to load workouts.' })
        return
      }
      setWorkouts(
        (response.data || []).map((w) => ({ ...w, title: w.name || w.title || 'Workout' }))
      )
      setStatus({ type: 'success', message: '' })
    })
    return () => { isMounted = false }
  }, [config, isAuthenticated, clearAuth])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return workouts
    return workouts.filter((w) => (w.title || '').toLowerCase().includes(term))
  }, [workouts, search])

  const handleDelete = async (workout) => {
    if (!window.confirm(`Delete "${workout.title}"? This cannot be undone.`)) return
    const response = await deleteWorkout(config, workout.id)
    if (response.unauthorized) { clearAuth(); return }
    if (response.ok) {
      setWorkouts((current) => current.filter((w) => w.id !== workout.id))
    }
  }

  return (
    <div className="workout-picker">
      <div className="workout-picker-toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter workouts..."
          className="builder-input"
        />
        <span className="builder-muted">{filtered.length} workouts</span>
        <button type="button" className="btn btn-primary" onClick={onNewWorkout}>
          + New Workout
        </button>
      </div>

      {status.type === 'loading' ? (
        <div className="notice notice-loading">{status.message}</div>
      ) : null}
      {status.type === 'error' ? (
        <div className="notice notice-error">{status.message}</div>
      ) : null}

      <div className="workout-grid">
        {filtered.map((workout) => (
          <div key={workout.code || workout.id} className="workout-card">
            <div className="workout-card-body" style={{ cursor: 'default' }}>
              <div className="workout-card-title">{workout.title}</div>
              <div className="workout-card-meta">
                <span>Exercises: {workout.actionNum || '--'}</span>
                <span>~{workout.durationMinute || '--'} min</span>
              </div>
            </div>
            <div className="workout-card-actions">
              <Link
                to={`/edit/${workout.code}`}
                className="workout-action workout-action-edit"
              >
                Load &amp; Edit
              </Link>
              <button
                type="button"
                className="workout-action workout-action-delete"
                onClick={() => handleDelete(workout)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default WorkoutPicker
