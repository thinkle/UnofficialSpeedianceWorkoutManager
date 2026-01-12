import { useEffect, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { fetchExerciseDetail } from '../lib/library.js'
import { useAuth } from '../state/AuthContext.jsx'

function ExerciseDetail() {
  const { exerciseId } = useParams()
  const { config, isAuthenticated } = useAuth()
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [detail, setDetail] = useState(null)

  const displayTitle =
    detail?.titleEn ||
    detail?.titleEN ||
    detail?.actionNameEn ||
    detail?.actionNameEN ||
    detail?.nameEn ||
    detail?.nameEN ||
    detail?.title ||
    detail?.actionName ||
    detail?.name ||
    ''

  useEffect(() => {
    let isMounted = true

    const loadDetail = async () => {
      if (!isAuthenticated) return
      if (!exerciseId) return
      setStatus({ type: 'loading', message: 'Loading exercise...' })
      const response = await fetchExerciseDetail(config, exerciseId)
      if (!isMounted) return
      if (response.ok) {
        setDetail(response.data)
        setStatus({ type: 'success', message: response.source === 'cache' ? 'Loaded from cache.' : '' })
      } else {
        setStatus({ type: 'error', message: response.error || 'Unable to load exercise.' })
      }
    }

    loadDetail()

    return () => {
      isMounted = false
    }
  }, [config, isAuthenticated, exerciseId])

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Exercise</p>
          <h1 className="page-title">{displayTitle || 'Exercise detail'}</h1>
          <p className="page-subtitle">
            ID: {exerciseId || '--'} - Media and cues will load here.
          </p>
        </div>
        <NavLink className="btn btn-outline" to="/library">
          Back to library
        </NavLink>
      </section>

      {!isAuthenticated ? (
        <div className="notice notice-error">Connect in Settings to load exercise details.</div>
      ) : null}
      {status.type === 'loading' ? (
        <div className="notice notice-loading">{status.message}</div>
      ) : null}
      {status.type === 'error' ? (
        <div className="notice notice-error">{status.message}</div>
      ) : null}

      <section className="grid-2">
        <div className="card media-preview">
          {detail?.img ? (
            <img src={detail.img} alt={detail.title || 'Exercise'} />
          ) : (
            <div className="media-placeholder">Video preview</div>
          )}
        </div>
        <div className="card">
          <h2 className="section-title">Movement notes</h2>
          <div className="stack">
            <div className="highlight">
              <div className="highlight-title">Primary focus</div>
              <div className="highlight-copy">{detail?.mainMuscleGroupName || 'Not available yet.'}</div>
            </div>
            <div className="highlight">
              <div className="highlight-title">Equipment</div>
              <div className="highlight-copy">
                {detail?.equipment_name_en ||
                  detail?.equipment_name ||
                  detail?.equipmentName ||
                  'Not available yet.'}
              </div>
            </div>
            <div className="highlight">
              <div className="highlight-title">Category</div>
              <div className="highlight-copy">
                {detail?.category_name_en || detail?.category_name || detail?.categoryName || 'Not available yet.'}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ExerciseDetail
