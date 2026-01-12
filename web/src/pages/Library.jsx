import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { fetchLibrary } from '../lib/library.js'
import { useAuth } from '../state/AuthContext.jsx'

function Library() {
  const { config, isAuthenticated, clearAuth } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [library, setLibrary] = useState({ exercises: [], categories: [] })
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    let isMounted = true

    const loadLibrary = async () => {
      if (!isAuthenticated) return
      setStatus({ type: 'loading', message: 'Loading library...' })
      try {
        const response = await fetchLibrary(config)
        if (!isMounted) return
        if (response.ok) {
          setLibrary(response.data)
          setStatus({
            type: 'success',
            message: response.source === 'cache' ? 'Loaded from cache.' : 'Library synced.',
          })
        } else {
          if (response.unauthorized) {
            clearAuth()
            setStatus({ type: 'error', message: 'Session expired. Please sign in again.' })
            navigate('/settings', { replace: true })
            return
          }
          if (import.meta.env.DEV) {
            console.error('[Library] Fetch failed', response)
          }
          setStatus({ type: 'error', message: response.error || 'Failed to load library.' })
        }
      } catch (error) {
        if (!isMounted) return
        if (error?.code === 'UNAUTHORIZED' || error?.message === 'Unauthorized.') {
          clearAuth()
          setStatus({ type: 'error', message: 'Session expired. Please sign in again.' })
          navigate('/settings', { replace: true })
          return
        }
        if (import.meta.env.DEV) {
          console.error('[Library] Fetch exception', error)
        }
        setStatus({ type: 'error', message: 'Failed to load library.' })
      }
    }

    loadLibrary()

    return () => {
      isMounted = false
    }
  }, [config, isAuthenticated])

  const filteredExercises = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (library.exercises || []).filter((exercise) => {
      if (activeCategory !== 'all' && String(exercise.category_id) !== activeCategory) {
        return false
      }
      if (!term) return true
      const haystack = [
        exercise.title,
        exercise.category_name,
        exercise.mainMuscleGroupName,
        exercise.equipment_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [library.exercises, search, activeCategory])

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="page-title">Browse the exercise library.</h1>
          <p className="page-subtitle">
            {isAuthenticated
              ? `${filteredExercises.length} exercises available.`
              : 'Connect to load the exercise library.'}
          </p>
        </div>
        <div className="search-field">
          <input
            type="text"
            placeholder="Search exercises"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!isAuthenticated}
          />
          <span className="search-hint">Filter by name, muscle, or equipment.</span>
        </div>
      </section>

      {!isAuthenticated ? (
        <section className="card callout">
          <div>
            <h2 className="section-title">Connect to continue</h2>
            <p className="page-subtitle">
              Sign in from Settings to sync exercises into your local cache.
            </p>
          </div>
          <NavLink className="btn btn-primary" to="/settings">
            Go to Settings
          </NavLink>
        </section>
      ) : null}

      {status.type === 'loading' ? (
        <div className="notice notice-loading">{status.message}</div>
      ) : null}
      {status.type === 'error' ? (
        <div className="notice notice-error">{status.message}</div>
      ) : null}

      <section className="filter-row">
        <button
          className={`chip${activeCategory === 'all' ? ' chip-active' : ''}`}
          type="button"
          onClick={() => setActiveCategory('all')}
        >
          All categories
        </button>
        {(library.categories || []).map((category) => (
          <button
            key={category.id}
            className={`chip${String(category.id) === activeCategory ? ' chip-active' : ''}`}
            type="button"
            onClick={() => setActiveCategory(String(category.id))}
          >
            {category.displayName || category.name}
          </button>
        ))}
        {isAuthenticated ? (
          <div className="filter-meta">{filteredExercises.length} shown</div>
        ) : null}
      </section>

      <section className="grid-3">
        {filteredExercises.map((exercise) => {
          const focus =
            exercise.mainMuscleGroupNameEn ||
            exercise.mainMuscleGroupNameEN ||
            exercise.mainMuscleGroupName ||
            'Focus'
          const equipment =
            exercise.equipment_name_en ||
            exercise.equipment_name_en_us ||
            exercise.equipment_name_en_gb ||
            exercise.equipment_name ||
            exercise.equipmentName

          return (
          <div key={exercise.id} className="card exercise-card">
            <div className="exercise-header">
              <span className="tag">{focus}</span>
              <NavLink className="btn btn-ghost" to={`/library/${exercise.id}`}>
                Details
              </NavLink>
            </div>
            <div className="exercise-title">{exercise.title || 'Untitled'}</div>
            <div className="exercise-meta">
              {exercise.category_name || 'Category'}
              {equipment ? ` - ${equipment}` : ''}
            </div>
          </div>
          )
        })}
      </section>
    </div>
  )
}

export default Library
