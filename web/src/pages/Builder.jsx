import { useEffect, useMemo, useState } from 'react'
import { fetchExerciseDetailsBatch, fetchLibrary } from '../lib/library.js'
import { useAuth } from '../state/AuthContext.jsx'

const DETAIL_FETCH_LIMIT = 75

function formatCablePosition(value) {
  if (value === 'unknown') return 'Unknown'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  if (numeric === 10) return 'Platform End (Lowest/Floor)'
  if (numeric === 0) return 'Top (Highest)'
  return `Level ${numeric}`
}

function Builder() {
  const { config, isAuthenticated } = useAuth()
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [library, setLibrary] = useState({ exercises: [], categories: [] })
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [deviceFilter, setDeviceFilter] = useState('all')
  const [detailEnabled, setDetailEnabled] = useState(false)
  const [detailCable, setDetailCable] = useState('all')
  const [detailBench, setDetailBench] = useState('all')
  const [fuzzyCable, setFuzzyCable] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailMessage, setDetailMessage] = useState('')
  const [detailMap, setDetailMap] = useState({})
  const [detailOptions, setDetailOptions] = useState({ cables: [], benches: [] })
  const [showImport, setShowImport] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

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
          setStatus({ type: 'success', message: '' })
        } else {
          setStatus({ type: 'error', message: response.error || 'Failed to load library.' })
        }
      } catch (error) {
        if (!isMounted) return
        setStatus({ type: 'error', message: 'Failed to load library.' })
      }
    }

    loadLibrary()

    return () => {
      isMounted = false
    }
  }, [config, isAuthenticated])

  const baseExercises = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (library.exercises || []).filter((exercise) => {
      if (categoryId !== 'all') {
        const categories = String(categoryId).split(',').map((value) => value.trim())
        if (!categories.includes(String(exercise.category_id))) {
          return false
        }
      }
      if (deviceFilter !== 'all') {
        const devices = String(exercise.device_type_tag || exercise.device_type || '')
          .split(',')
          .map((value) => value.trim())
        if (!devices.includes(deviceFilter)) {
          return false
        }
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
  }, [library.exercises, search, categoryId, deviceFilter])

  const filteredExercises = useMemo(() => {
    if (!detailEnabled || (detailCable === 'all' && detailBench === 'all')) {
      return baseExercises
    }

    return baseExercises.filter((exercise) => {
      const detail = detailMap[exercise.id]
      if (!detail) return false

      const cableValue =
        detail.outPosition === undefined || detail.outPosition === null
          ? 'unknown'
          : String(detail.outPosition)
      const benchValue =
        detail.foldingStoolAngle === undefined ||
        detail.foldingStoolAngle === null ||
        detail.foldingStoolAngle === ''
          ? 'unknown'
          : String(detail.foldingStoolAngle)

      let cableMatch = detailCable === 'all' || cableValue === detailCable
      if (!cableMatch && fuzzyCable && detailCable !== 'all') {
        const cableNum = Number(cableValue)
        const filterNum = Number(detailCable)
        if (!Number.isNaN(cableNum) && !Number.isNaN(filterNum)) {
          cableMatch = Math.abs(cableNum - filterNum) <= 1
        }
      }

      const benchMatch = detailBench === 'all' || benchValue === detailBench
      return cableMatch && benchMatch
    })
  }, [baseExercises, detailEnabled, detailCable, detailBench, fuzzyCable, detailMap])

  useEffect(() => {
    let isMounted = true

    const loadDetailData = async () => {
      if (!detailEnabled || !isAuthenticated) {
        setDetailMessage('')
        setDetailOptions({ cables: [], benches: [] })
        return
      }

      const candidateIds = baseExercises.map((exercise) => exercise.id)
      if (candidateIds.length === 0) {
        setDetailMessage('Detail filters load when base filters are active.')
        return
      }

      if (candidateIds.length > DETAIL_FETCH_LIMIT) {
        setDetailMessage(
          `Detail filters paused at ${candidateIds.length} results. Narrow below ${DETAIL_FETCH_LIMIT}.`
        )
        return
      }

      const hasAllDetails = candidateIds.every((id) => detailMap[id])
      let nextMap = detailMap

      if (!hasAllDetails) {
        setDetailLoading(true)
        setDetailMessage(`Loading details for ${candidateIds.length} exercises...`)

        const response = await fetchExerciseDetailsBatch(config, candidateIds)
        if (!isMounted) return

        setDetailLoading(false)
        if (!response.ok) {
          setDetailMessage(response.error || 'Unable to load detail filters.')
          return
        }

        nextMap = { ...detailMap, ...response.data }
        setDetailMap(nextMap)
      }

      const cableValues = new Set()
      const benchValues = new Set()
      candidateIds.forEach((id) => {
        const detail = nextMap[id]
        if (!detail) {
          cableValues.add('unknown')
          benchValues.add('unknown')
          return
        }
        if (detail.outPosition === undefined || detail.outPosition === null) {
          cableValues.add('unknown')
        } else {
          cableValues.add(String(detail.outPosition))
        }
        if (
          detail.foldingStoolAngle === undefined ||
          detail.foldingStoolAngle === null ||
          detail.foldingStoolAngle === ''
        ) {
          benchValues.add('unknown')
        } else {
          benchValues.add(String(detail.foldingStoolAngle))
        }
      })

      const sortNumeric = (a, b) => {
        if (a === 'unknown') return 1
        if (b === 'unknown') return -1
        return Number(a) - Number(b)
      }

      setDetailOptions({
        cables: Array.from(cableValues).sort(sortNumeric),
        benches: Array.from(benchValues).sort(sortNumeric),
      })
      setDetailMessage('')
    }

    loadDetailData()

    return () => {
      isMounted = false
    }
  }, [baseExercises, detailEnabled, isAuthenticated, config, detailMap])

  const showDeviceFilters = config.device_type === 2 && config.allow_monster_moves

  return (
    <div className="page builder-page">
      <section className="builder-shell">
        <aside className="builder-panel builder-panel-left">
          <div className="builder-panel-header">
            <h2 className="section-title">Library</h2>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              className="builder-input"
              disabled={!isAuthenticated}
            />
          </div>

          <div className="builder-panel-scroll">
            <details className="builder-details">
              <summary>Filters</summary>
              <div className="builder-details-body">
                <label className="builder-checkbox">
                  <input type="checkbox" />
                  Full text (equipment, muscles, category)
                </label>
                <label className="builder-checkbox">
                  <input type="checkbox" />
                  Same equipment as previous
                </label>
                <label className="builder-checkbox">
                  <input
                    type="checkbox"
                    checked={detailEnabled}
                    onChange={(event) => setDetailEnabled(event.target.checked)}
                  />
                  Enable detailed filtering
                </label>
                {detailMessage ? (
                  <div className="builder-muted">{detailMessage}</div>
                ) : null}

                <details className="builder-subdetails">
                  <summary>Equipment filters</summary>
                  <div className="builder-two-col">
                    <div>
                      <div className="builder-muted">Include</div>
                      <div className="builder-placeholder">No equipment filters yet.</div>
                    </div>
                    <div>
                      <div className="builder-muted">Exclude</div>
                      <div className="builder-placeholder">No equipment filters yet.</div>
                    </div>
                  </div>
                </details>

                <div className="builder-subdetails">
                  <div className="builder-subdetails-title">Detail filters (cable height, bench angle)</div>
                  <label className="builder-checkbox">
                    <input
                      type="checkbox"
                      checked={fuzzyCable}
                      onChange={(event) => setFuzzyCable(event.target.checked)}
                      disabled={!detailEnabled}
                    />
                    Fuzzy cable height (plus/minus 1)
                  </label>
                  <div className="builder-two-col">
                    <select
                      className="builder-select"
                      disabled={!detailEnabled || detailLoading}
                      value={detailCable}
                      onChange={(event) => setDetailCable(event.target.value)}
                    >
                      <option value="all">Cable height: Any</option>
                      {detailOptions.cables.map((value) => (
                        <option key={value} value={value}>
                          Cable height: {formatCablePosition(value)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="builder-select"
                      disabled={!detailEnabled || detailLoading}
                      value={detailBench}
                      onChange={(event) => setDetailBench(event.target.value)}
                    >
                      <option value="all">Bench angle: Any</option>
                      {detailOptions.benches.map((value) => (
                        <option key={value} value={value}>
                          Bench angle: {value === 'unknown' ? 'Unknown' : `${value} deg`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="builder-muted">
                    {detailLoading ? 'Loading detail filters...' : 'Detail filters auto-load when base filters are active.'}
                  </div>
                </div>
              </div>
            </details>

            <select
              className="builder-select builder-select-wide"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={!isAuthenticated}
            >
              <option value="all">All Categories</option>
              {(library.categories || []).map((category) => (
                <option key={category.id} value={category.filter_ids || category.id}>
                  {category.displayName || category.name}
                </option>
              ))}
            </select>

            {showDeviceFilters ? (
              <div className="builder-device-row">
                {[
                  { id: 'all', label: 'All Devices' },
                  { id: '2', label: 'Device Type 2' },
                  { id: '1', label: 'Device Type 1' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`builder-chip${deviceFilter === option.id ? ' builder-chip-active' : ''}`}
                    onClick={() => setDeviceFilter(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {status.type === 'loading' ? (
              <div className="notice notice-loading">{status.message}</div>
            ) : null}
            {status.type === 'error' ? (
              <div className="notice notice-error">{status.message}</div>
            ) : null}

            <div className="builder-list">
              {filteredExercises.map((exercise) => (
                <div key={exercise.id} className="builder-item">
                  <div className="builder-item-title">{exercise.title || 'Untitled'}</div>
                  <div className="builder-item-meta">
                    {exercise.category_name || 'Category'}
                    {exercise.mainMuscleGroupName ? ` - ${exercise.mainMuscleGroupName}` : ''}
                  </div>
                  <button type="button" className="btn btn-ghost builder-item-action">
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="builder-panel builder-panel-right">
          <details className="builder-advanced">
            <summary>More Features (AI and Import/Export)</summary>
            <div className="builder-advanced-body">
              <div className="builder-advanced-info">
                <h4>How to create workouts with AI:</h4>
                <ol>
                  <li>Generate a prompt and describe the workout goal.</li>
                  <li>Paste into your preferred LLM.</li>
                  <li>Copy the JSON output.</li>
                  <li>Import JSON to build instantly.</li>
                </ol>
                <p className="builder-muted">
                  Export JSON to share the current plan or ask for adjustments.
                </p>
              </div>
              <div className="builder-advanced-actions">
                <button className="btn btn-outline" type="button" onClick={() => setShowPrompt(true)}>
                  Generate Prompt
                </button>
                <button className="btn btn-outline" type="button" onClick={() => setShowImport(true)}>
                  Import JSON
                </button>
                <button className="btn btn-outline" type="button">
                  Export JSON
                </button>
              </div>
            </div>
          </details>

          <div className="builder-toolbar">
            <input className="builder-title" placeholder="Workout name" />
            <div className="builder-toolbar-actions">
              <label className="builder-checkbox">
                <input type="checkbox" />
                Condensed view
              </label>
              <button className="btn btn-ghost" type="button">
                Make circuit from selected
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowDebug(true)}>
                Debug JSON
              </button>
              <span className="builder-muted">0 selected</span>
              <span className="builder-muted">0 exercises</span>
              <button className="btn btn-primary" type="button">
                Save
              </button>
            </div>
          </div>

          <div className="builder-canvas">
            <div className="builder-empty">
              Select exercises from the library to build a plan.
            </div>
          </div>
        </section>
      </section>

      {showImport ? (
        <div className="builder-modal">
          <div className="builder-modal-card">
            <h3>Import Workout JSON</h3>
            <textarea placeholder="Paste JSON..." />
            <div className="builder-modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setShowImport(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button">
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDebug ? (
        <div className="builder-modal">
          <div className="builder-modal-card builder-modal-wide">
            <h3>Workout Debug JSON</h3>
            <textarea readOnly value="{}" />
            <div className="builder-modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setShowDebug(false)}>
                Close
              </button>
              <button className="btn btn-outline" type="button">
                Copy JSON
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPrompt ? (
        <div className="builder-modal">
          <div className="builder-modal-card builder-modal-wide">
            <h3>Generate AI Prompt</h3>
            <textarea placeholder="Describe the workout you want..." />
            <div className="builder-modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setShowPrompt(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button">
                Generate Prompt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Builder
