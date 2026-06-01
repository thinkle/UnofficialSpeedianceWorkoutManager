import { useEffect, useState } from 'react'
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

function ExerciseDetailModal({ exercises, currentIndex, onClose, onAdd, onNavigate }) {
  const { config } = useAuth()
  const exercise = exercises[currentIndex]
  const exerciseId = exercise?.id
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!exerciseId) return
    let isMounted = true
    setLoading(true)
    setError('')
    setDetail(null)
    fetchExerciseDetail(config, String(exerciseId)).then((response) => {
      if (!isMounted) return
      setLoading(false)
      if (response.ok) {
        setDetail(response.data)
      } else {
        setError(response.error || 'Unable to load exercise.')
      }
    })
    return () => { isMounted = false }
  }, [config, exerciseId])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const displayTitle =
    detail?.titleEn || detail?.titleEN || detail?.actionNameEn ||
    detail?.actionNameEN || detail?.nameEn || detail?.nameEN ||
    detail?.title || detail?.actionName || detail?.name ||
    exercise?.title || ''

  const showDetails = parseShowDetails(detail?.showDetails)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < exercises.length - 1

  return (
    <div
      className="builder-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="exercise-detail-modal">
        <div className="exercise-detail-modal-header">
          <div className="exercise-detail-modal-nav">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate(currentIndex - 1)}
              disabled={!hasPrev}
            >
              ← Prev
            </button>
            <span className="builder-muted">
              {currentIndex + 1} / {exercises.length}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate(currentIndex + 1)}
              disabled={!hasNext}
            >
              Next →
            </button>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="exercise-detail-modal-body">
          {loading ? <div className="notice notice-loading">Loading...</div> : null}
          {error ? <div className="notice notice-error">{error}</div> : null}

          {detail || exercise ? (
            <>
              <div className="exercise-detail-modal-top">
                <div className="exercise-detail-modal-img">
                  {(detail?.img || exercise?.img) ? (
                    <img src={detail?.img || exercise?.img} alt={displayTitle} />
                  ) : (
                    <div className="media-placeholder">No image</div>
                  )}
                </div>
                <div>
                  <h2 className="exercise-detail-modal-title">{displayTitle}</h2>
                  <div className="stack">
                    <div className="highlight">
                      <div className="highlight-title">Primary focus</div>
                      <div className="highlight-copy">
                        {detail?.mainMuscleGroupName || exercise?.mainMuscleGroupName || '—'}
                      </div>
                    </div>
                    <div className="highlight">
                      <div className="highlight-title">Equipment</div>
                      <div className="highlight-copy">
                        {detail?.equipment_name || exercise?.equipment_name || '—'}
                      </div>
                    </div>
                    <div className="highlight">
                      <div className="highlight-title">Category</div>
                      <div className="highlight-copy">
                        {detail?.category_name || detail?.tabName || exercise?.category_name || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {detail?.context ? (
                <div>
                  <h3 className="section-title">Instructions</h3>
                  <ContextSteps text={detail.context} />
                </div>
              ) : null}

              {(detail?.breathingRate || detail?.motionFeeling || detail?.errorCorrection) ? (
                <div className="exercise-detail-modal-cues">
                  {detail?.breathingRate ? (
                    <div className="card">
                      <div className="highlight-title">Breathing</div>
                      <p className="highlight-copy">{detail.breathingRate}</p>
                    </div>
                  ) : null}
                  {detail?.motionFeeling ? (
                    <div className="card">
                      <div className="highlight-title">What to feel</div>
                      <p className="highlight-copy">{detail.motionFeeling}</p>
                    </div>
                  ) : null}
                  {detail?.errorCorrection ? (
                    <div className="card">
                      <div className="highlight-title">Common errors</div>
                      <p className="highlight-copy">{detail.errorCorrection}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showDetails.length > 0 ? (
                <div>
                  <h3 className="section-title">Step by step</h3>
                  <div className="exercise-detail-modal-steps">
                    {showDetails.map((step, i) => (
                      <div key={i} className="step-card">
                        {step.img ? <img src={step.img} alt={`Step ${i + 1}`} /> : null}
                        {step.context ? (
                          <p className="step-caption">{step.context.replace(/^\d+\./, '').trim()}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="exercise-detail-modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Dismiss
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { onAdd(exercise); onClose() }}
          >
            + Add to Workout
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExerciseDetailModal
