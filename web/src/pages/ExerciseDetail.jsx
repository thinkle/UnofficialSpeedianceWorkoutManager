import { useEffect, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { fetchExerciseDetail } from '../lib/library.js'
import { useAuth } from '../state/AuthContext.jsx'

function parseShowDetails(raw) {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function ContextSteps({ text }) {
  if (!text) return null
  const steps = text.split('\n').filter(Boolean)
  return (
    <ol className="context-steps">
      {steps.map((step, i) => (
        <li key={i}>{step.replace(/^\d+\./, '').trim()}</li>
      ))}
    </ol>
  )
}

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

  const showDetails = parseShowDetails(detail?.showDetails)

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Exercise</p>
          <h1 className="page-title">{displayTitle || 'Exercise detail'}</h1>
          <p className="page-subtitle">ID: {exerciseId || '--'}</p>
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
            <img src={detail.img} alt={displayTitle || 'Exercise'} />
          ) : (
            <div className="media-placeholder">No image available</div>
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
                {detail?.category_name_en || detail?.category_name || detail?.categoryName || detail?.tabName || 'Not available yet.'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {detail?.context ? (
        <section className="card">
          <h2 className="section-title">Instructions</h2>
          <ContextSteps text={detail.context} />
        </section>
      ) : null}

      {(detail?.breathingRate || detail?.motionFeeling || detail?.errorCorrection) ? (
        <section className="grid-3">
          {detail?.breathingRate ? (
            <div className="card">
              <div className="highlight-title">Breathing</div>
              <p>{detail.breathingRate}</p>
            </div>
          ) : null}
          {detail?.motionFeeling ? (
            <div className="card">
              <div className="highlight-title">What to feel</div>
              <p>{detail.motionFeeling}</p>
            </div>
          ) : null}
          {detail?.errorCorrection ? (
            <div className="card">
              <div className="highlight-title">Common errors</div>
              <p>{detail.errorCorrection}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {showDetails.length > 0 ? (
        <section className="card">
          <h2 className="section-title">Step by step</h2>
          <div className="grid-3">
            {showDetails.map((step, i) => (
              <div key={i} className="step-card">
                {step.img ? (
                  <img src={step.img} alt={`Step ${i + 1}`} />
                ) : null}
                {step.context ? (
                  <p className="step-caption">{step.context.replace(/^\d+\./, '').trim()}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default ExerciseDetail
