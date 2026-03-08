import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchExerciseDetailsBatch, fetchLibrary } from '../lib/library.js'
import { fetchWorkoutDetail, saveWorkout } from '../lib/workouts.js'
import { useAuth } from '../state/AuthContext.jsx'
import ExerciseCard from '../components/ExerciseCard.jsx'
import CircuitBlock from '../components/CircuitBlock.jsx'
import {
  parseWorkoutBlocks,
  replaceExercisesWithCircuit,
  undoCircuit,
  removeCircuit,
  moveCircuit,
  appendSetToCircuit,
  deleteSetFromCircuit,
  deleteExerciseFromCircuit,
} from '../lib/circuits.js'
import { applyPresetToSets } from '../lib/presets.js'
import { condenseBuilderWorkout } from '../lib/export.js'

const DETAIL_FETCH_LIMIT = 75

const EXERCISE_MARKER = '\n\n--- Available exercises (auto-appended by Generate — edit above freely) ---'

const DEFAULT_PROMPT_TEMPLATE = `You are a fitness coach. Create a structured workout plan as JSON.

User request: TYPE YOUR GOAL HERE

Instructions:
- Only use exercises from the list (use the exact groupId)
- Include 3 sets per exercise with realistic weights
- preset_id: -1=Custom weight (kg), 1=Gain Muscle, 3=Stamina, 5=Strength
- mode: 1=Standard, 2=Chains, 3=Eccentric
- unit: "reps" or "sec"

Return ONLY valid JSON in exactly this format (no explanation, no markdown fences):
{
  "name": "My Workout",
  "exercises": [
    {
      "groupId": 123456,
      "title": "Example Exercise",
      "preset_id": -1,
      "isUnilateral": false,
      "sets": [
        { "reps": 10, "weight": 20, "rest": 60, "mode": 1, "unit": "reps" },
        { "reps": 10, "weight": 20, "rest": 60, "mode": 1, "unit": "reps" },
        { "reps": 10, "weight": 20, "rest": 60, "mode": 1, "unit": "reps" }
      ]
    }
  ]
}`

function pickEquipmentName(exercise) {
  return exercise.equipment_name || ''
}

function scoreRelevance(exercise, words) {
  const titleLower = (exercise.title || '').toLowerCase()
  let score = 0
  for (const word of words) {
    if (titleLower.includes(word)) score += 2
  }
  return score
}

function formatCablePosition(value) {
  if (value === 'unknown') return 'Unknown'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  if (numeric === 10) return 'Platform End (Lowest/Floor)'
  if (numeric === 0) return 'Top (Highest)'
  return `Level ${numeric}`
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createDefaultSet() {
  return {
    id: generateId(),
    reps: 10,
    weight: 20,
    rest: 60,
    mode: 1,
    unit: 'reps',
  }
}

function createExerciseFromLibrary(libraryExercise) {
  return {
    id: generateId(),
    groupId: libraryExercise.id,
    title: libraryExercise.title || 'Untitled',
    img: libraryExercise.img || '',
    category_name: libraryExercise.category_name || '',
    preset_id: -1,
    isUnilateral: false,
    sets: [createDefaultSet(), createDefaultSet(), createDefaultSet()],
  }
}

function normalizeExistingWorkout(workout) {
  if (!workout) return null

  const exercises = (workout.actionLibraryList || []).map((action) => {
    const setsAndReps = (action.setsAndReps || '').split(',').filter(Boolean)
    const weights = (action.weights || '').split(',').filter(Boolean)
    const breakTimes = (action.breakTime || action.breakTime2 || '').split(',').filter(Boolean)
    const modes = (action.sportMode || '').split(',').filter(Boolean)
    // API uses lowercase 'counterweight2'
    const counterWeights = (action.counterweight2 || action.counterWeight2 || '').split(',').filter(Boolean)

    // templatePresetId: -1 = Custom, 1 = Gain Muscle, 3 = Stamina, 5 = Strength
    const rawPresetId = action.templatePresetId
    const presetId = rawPresetId === undefined || rawPresetId === null || rawPresetId === ''
      ? -1
      : parseInt(rawPresetId, 10)
    const isRM = presetId !== -1 && presetId !== 0

    const sets = setsAndReps.map((reps, index) => {
      let weight = 0
      if (isRM && counterWeights[index]) {
        // For RM presets, use counterweight2 (the RM value)
        weight = parseInt(counterWeights[index], 10)
      } else {
        // For custom, weights are in KG from the API
        const rawWeight = parseFloat(weights[index] || 0)
        weight = Math.round(rawWeight)
      }

      return {
        id: generateId(),
        reps: parseInt(reps, 10) || 10,
        weight,
        rest: parseInt(breakTimes[index] || 60, 10),
        mode: parseInt(modes[index] || 1, 10),
        unit: 'reps',
      }
    })

    return {
      id: generateId(),
      groupId: action.groupId,
      title: action.name || action.title || 'Untitled',
      img: action.img || '',
      category_name: '',
      preset_id: presetId,
      variant_id: action.actionLibraryId,
      isUnilateral: action.isLeftRight === 1,
      sets: sets.length > 0 ? sets : [createDefaultSet()],
    }
  })

  return {
    id: workout.id,
    name: workout.name || '',
    exercises,
  }
}

function Builder() {
  const { config, isAuthenticated, clearAuth } = useAuth()
  const navigate = useNavigate()
  const { workoutCode } = useParams()

  // Library state
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [library, setLibrary] = useState({ exercises: [], categories: [] })
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [deviceFilter, setDeviceFilter] = useState('all')
  const [equipmentFilter, setEquipmentFilter] = useState('all')
  const [detailEnabled, setDetailEnabled] = useState(false)
  const [detailCable, setDetailCable] = useState('all')
  const [detailBench, setDetailBench] = useState('all')
  const [fuzzyCable, setFuzzyCable] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailMessage, setDetailMessage] = useState('')
  const [detailMap, setDetailMap] = useState({})
  const [detailOptions, setDetailOptions] = useState({ cables: [], benches: [] })

  // Workout state
  const [workoutId, setWorkoutId] = useState(null)
  const [workoutName, setWorkoutName] = useState('')
  const [exercises, setExercises] = useState([])
  const [selectedExercises, setSelectedExercises] = useState(new Set())
  const [condensedView, setCondensedView] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Modal state
  const [showImport, setShowImport] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [exportMode, setExportMode] = useState('condensed')
  const [showPrompt, setShowPrompt] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [promptText, setPromptText] = useState(DEFAULT_PROMPT_TEMPLATE)

  const isEditMode = Boolean(workoutCode)

  // Parse exercises into blocks (circuits + singles)
  const workoutBlocks = useMemo(() => parseWorkoutBlocks(exercises), [exercises])

  // Load library
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

  // Load existing workout if editing
  useEffect(() => {
    let isMounted = true

    const loadWorkout = async () => {
      if (!isAuthenticated || !workoutCode) return

      setStatus({ type: 'loading', message: 'Loading workout...' })
      const response = await fetchWorkoutDetail(config, workoutCode)

      if (!isMounted) return

      if (response.unauthorized) {
        clearAuth()
        navigate('/settings', { replace: true })
        return
      }

      if (!response.ok) {
        setStatus({ type: 'error', message: response.error || 'Failed to load workout.' })
        return
      }

      const normalized = normalizeExistingWorkout(response.data)
      if (normalized) {
        setWorkoutId(normalized.id)
        setWorkoutName(normalized.name)
        setExercises(normalized.exercises)
      }
      setStatus({ type: 'success', message: '' })
    }

    loadWorkout()

    return () => {
      isMounted = false
    }
  }, [config, isAuthenticated, workoutCode, clearAuth, navigate])

  // Library filtering
  const equipmentOptions = useMemo(() => {
    const names = new Set()
    ;(library.exercises || []).forEach((ex) => {
      const name = pickEquipmentName(ex)
      if (name) names.add(name)
    })
    return Array.from(names).sort()
  }, [library.exercises])

  const baseExercises = useMemo(() => {
    const term = search.trim().toLowerCase()
    const words = term ? term.split(/\s+/).filter(Boolean) : []

    const matched = (library.exercises || []).filter((exercise) => {
      if (categoryId !== 'all') {
        const categories = String(categoryId).split(',').map((value) => value.trim())
        if (!categories.includes(String(exercise.category_id))) {
          return false
        }
      }
      if (equipmentFilter !== 'all') {
        if (pickEquipmentName(exercise) !== equipmentFilter) return false
      }
      if (deviceFilter !== 'all') {
        const devices = String(exercise.device_type_tag || exercise.device_type || '')
          .split(',')
          .map((value) => value.trim())
        if (!devices.includes(deviceFilter)) {
          return false
        }
      }
      if (words.length === 0) return true
      const haystack = [
        exercise.title,
        exercise.category_name,
        exercise.mainMuscleGroupName,
        exercise.equipment_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return words.every((word) => haystack.includes(word))
    })

    if (words.length === 0) return matched
    return matched.sort((a, b) => scoreRelevance(b, words) - scoreRelevance(a, words))
  }, [library.exercises, search, categoryId, equipmentFilter, deviceFilter])

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

  // Detail filter data loading
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

  // Exercise actions
  const addExercise = useCallback((libraryExercise) => {
    const newExercise = createExerciseFromLibrary(libraryExercise)
    setExercises((prev) => [...prev, newExercise])
  }, [])

  const removeExercise = useCallback((exerciseId) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId))
    setSelectedExercises((prev) => {
      const next = new Set(prev)
      next.delete(exerciseId)
      return next
    })
  }, [])

  const updateExercise = useCallback((exerciseId, updates) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, ...updates } : ex))
    )
  }, [])

  const addSet = useCallback((exerciseId, newSet) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId ? { ...ex, sets: [...ex.sets, newSet] } : ex
      )
    )
  }, [])

  const removeSet = useCallback((exerciseId, setId) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
          : ex
      )
    )
  }, [])

  const updateSet = useCallback((exerciseId, setId, updates) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s)),
            }
          : ex
      )
    )
  }, [])

  const toggleSelectExercise = useCallback((exerciseId) => {
    setSelectedExercises((prev) => {
      const next = new Set(prev)
      if (next.has(exerciseId)) {
        next.delete(exerciseId)
      } else {
        next.add(exerciseId)
      }
      return next
    })
  }, [])

  const moveExercise = useCallback((exerciseId, direction) => {
    setExercises((prev) => {
      const index = prev.findIndex((ex) => ex.id === exerciseId)
      if (index === -1) return prev
      const newIndex = index + direction
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      next.splice(newIndex, 0, removed)
      return next
    })
  }, [])

  // Circuit actions
  const handleMakeCircuit = useCallback(() => {
    if (selectedExercises.size < 2) {
      alert('Select at least 2 exercises to make a circuit.')
      return
    }
    const indexes = []
    exercises.forEach((ex, idx) => {
      if (selectedExercises.has(ex.id)) {
        indexes.push(idx)
      }
    })
    const newExercises = replaceExercisesWithCircuit(exercises, indexes)
    setExercises(newExercises)
    setSelectedExercises(new Set())
  }, [exercises, selectedExercises])

  const handleUndoCircuit = useCallback(
    (blockIndex) => {
      const newExercises = undoCircuit(exercises, blockIndex)
      setExercises(newExercises)
    },
    [exercises]
  )

  const handleRemoveCircuit = useCallback(
    (blockIndex) => {
      const newExercises = removeCircuit(exercises, blockIndex)
      setExercises(newExercises)
    },
    [exercises]
  )

  const handleMoveCircuit = useCallback(
    (blockIndex, direction) => {
      const newExercises = moveCircuit(exercises, blockIndex, blockIndex + direction)
      setExercises(newExercises)
    },
    [exercises]
  )

  const handleAddRound = useCallback(
    (blockIndex) => {
      const newExercises = appendSetToCircuit(exercises, blockIndex)
      setExercises(newExercises)
    },
    [exercises]
  )

  const handleRemoveRound = useCallback(
    (blockIndex) => {
      const block = workoutBlocks[blockIndex]
      if (block && block.rounds > 1) {
        const newExercises = deleteSetFromCircuit(exercises, blockIndex, block.rounds - 1)
        setExercises(newExercises)
      }
    },
    [exercises, workoutBlocks]
  )

  const handleRemoveCircuitExercise = useCallback(
    (blockIndex, exerciseIndex) => {
      const newExercises = deleteExerciseFromCircuit(exercises, blockIndex, exerciseIndex)
      setExercises(newExercises)
    },
    [exercises]
  )

  const handleUpdateCircuitExercise = useCallback(
    (blockIndex, positionIndex, updates) => {
      const block = workoutBlocks[blockIndex]
      if (!block || block.type !== 'circuit') return

      // Update all instances of this exercise position across rounds
      setExercises((prev) => {
        const newExercises = [...prev]
        for (let round = 0; round < block.rounds; round++) {
          const idx = block.start + positionIndex + round * block.cycleLen
          if (newExercises[idx]) {
            newExercises[idx] = { ...newExercises[idx], ...updates }
            // If changing preset, also update sets
            if (updates.preset_id !== undefined) {
              newExercises[idx].sets = applyPresetToSets(
                newExercises[idx].sets,
                updates.preset_id
              )
            }
          }
        }
        return newExercises
      })
    },
    [workoutBlocks]
  )

  const handleUpdateCircuitSet = useCallback(
    (blockIndex, positionIndex, roundIndex, setIndex, updates) => {
      const block = workoutBlocks[blockIndex]
      if (!block || block.type !== 'circuit') return

      const exerciseIdx = block.start + positionIndex + roundIndex * block.cycleLen
      setExercises((prev) => {
        const newExercises = [...prev]
        const exercise = newExercises[exerciseIdx]
        if (exercise && exercise.sets[setIndex]) {
          exercise.sets = exercise.sets.map((s, i) =>
            i === setIndex ? { ...s, ...updates } : s
          )
          newExercises[exerciseIdx] = { ...exercise }
        }
        return newExercises
      })
    },
    [workoutBlocks]
  )

  // Build API payload
  const buildPayload = useCallback(() => {
    return exercises.map((ex) => {
      const reps = ex.sets.map((s) => String(s.reps)).join(',')
      const isRM = ex.preset_id !== -1 && ex.preset_id !== 0

      // For RM mode: weights field gets the RM value, counterweight2 also gets RM value
      // For custom mode: weights field gets KG value (API stores in KG)
      const weights = ex.sets.map((s) => String(s.weight)).join(',')
      const breaks = ex.sets.map((s) => String(s.rest)).join(',')
      const modes = ex.sets.map((s) => String(s.mode)).join(',')
      const leftRight = ex.sets.map(() => '0').join(',')
      const completion = ex.sets.map(() => '1').join(',')
      const completionMethod = ex.sets.map(() => '1').join(',')
      const countType = ex.sets.map(() => '1').join(',')
      const level = ex.sets.map(() => '0').join(',')
      // counterweight2 holds the RM value for preset modes
      const counterWeight2 = isRM
        ? ex.sets.map((s) => String(s.weight)).join(',')
        : ex.sets.map(() => '0').join(',')

      const capacity = ex.sets.reduce((sum, s) => sum + s.reps * s.weight, 0)

      return {
        groupId: ex.groupId,
        actionLibraryId: ex.variant_id || ex.groupId,
        templatePresetId: ex.preset_id,
        setsAndReps: reps,
        weights,
        breakTime: breaks,
        breakTime2: breaks,
        sportMode: modes,
        leftRight,
        selectCompletionMethod: completion,
        completionMethod,
        countType,
        level,
        capacity,
        counterweight2: counterWeight2,
      }
    })
  }, [exercises])

  // Save workout
  const handleSave = async () => {
    if (!workoutName.trim()) {
      setSaveError('Please enter a workout name.')
      return
    }
    if (exercises.length === 0) {
      setSaveError('Please add at least one exercise.')
      return
    }

    setSaving(true)
    setSaveError('')

    const payload = buildPayload()
    const response = await saveWorkout(config, {
      name: workoutName.trim(),
      exercises: payload,
      templateId: workoutId,
    })

    if (response.unauthorized) {
      clearAuth()
      navigate('/settings', { replace: true })
      return
    }

    if (!response.ok) {
      setSaveError(response.error || 'Failed to save workout.')
      setSaving(false)
      return
    }

    setSaving(false)
    navigate('/')
  }

  // Import JSON
  const handleImport = () => {
    try {
      const sanitized = importJson
        .replace(/[\u201C\u201D]/g, '"') // " "  → "
        .replace(/[\u2018\u2019]/g, "'") // ' '  → '
      const parsed = JSON.parse(sanitized)
      const imported = Array.isArray(parsed) ? parsed : parsed.exercises || []
      const newExercises = imported.map((item) => ({
        id: generateId(),
        groupId: item.groupId || item.id,
        title: item.title || item.name || 'Imported',
        img: item.img || '',
        category_name: '',
        preset_id: item.preset_id ?? -1,
        isUnilateral: item.isUnilateral || false,
        sets: (item.sets || []).map((s) => ({
          id: generateId(),
          reps: s.reps || 10,
          weight: s.weight || 20,
          rest: s.rest || 60,
          mode: s.mode || 1,
          unit: s.unit || 'reps',
        })),
      }))
      setExercises((prev) => [...prev, ...newExercises])
      setShowImport(false)
      setImportJson('')
    } catch (e) {
      alert('Invalid JSON format.')
    }
  }

  // Generate AI prompt
  const promptPool = useMemo(
    () => (baseExercises.length > 0 ? baseExercises : (library.exercises || [])),
    [baseExercises, library.exercises]
  )

  const handleGeneratePrompt = useCallback(() => {
    const exerciseList = promptPool.map((ex) => ({
      groupId: ex.id,
      title: ex.title,
      category: ex.category_name || '',
      equipment: ex.equipment_name || '',
      muscles: ex.mainMuscleGroupName || '',
    }))

    // Strip any previously appended exercise section, then append the fresh one
    const instructionPart = promptText.includes(EXERCISE_MARKER)
      ? promptText.split(EXERCISE_MARKER)[0]
      : promptText

    const exerciseSection = `\nTotal: ${exerciseList.length} exercises\n` +
      JSON.stringify(exerciseList, null, 2)

    setPromptText(instructionPart + EXERCISE_MARKER + exerciseSection)
  }, [promptText, promptPool])

  // Export JSON
  const exportJson = useMemo(() => {
    return JSON.stringify(
      {
        name: workoutName,
        exercises: exercises.map((ex) => ({
          groupId: ex.groupId,
          title: ex.title,
          preset_id: ex.preset_id,
          isUnilateral: ex.isUnilateral,
          sets: ex.sets.map((s) => ({
            reps: s.reps,
            weight: s.weight,
            rest: s.rest,
            mode: s.mode,
          })),
        })),
      },
      null,
      2
    )
  }, [workoutName, exercises])

  const exportCondensed = useMemo(
    () => JSON.stringify(condenseBuilderWorkout(workoutName, exercises), null, 2),
    [workoutName, exercises]
  )

  const activeExport = exportMode === 'condensed' ? exportCondensed : exportJson

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

            <select
              className="builder-select builder-select-wide"
              value={equipmentFilter}
              onChange={(event) => setEquipmentFilter(event.target.value)}
              disabled={!isAuthenticated}
            >
              <option value="all">All Equipment</option>
              {equipmentOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            {showDeviceFilters ? (
              <div className="builder-device-row">
                {[
                  { id: 'all', label: 'All Devices' },
                  { id: '2', label: 'Gym Pal' },
                  { id: '1', label: 'Gym Monster' },
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
                  {exercise.img ? (
                    <img src={exercise.img} alt="" className="builder-item-img" />
                  ) : null}
                  <div className="builder-item-info">
                    <div className="builder-item-title">{exercise.title || 'Untitled'}</div>
                    <div className="builder-item-meta">
                      {exercise.category_name || 'Category'}
                      {exercise.mainMuscleGroupName ? ` - ${exercise.mainMuscleGroupName}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost builder-item-action"
                    onClick={() => addExercise(exercise)}
                  >
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
                <button className="btn btn-outline" type="button" onClick={() => setShowDebug(true)}>
                  Export JSON
                </button>
              </div>
            </div>
          </details>

          <div className="builder-toolbar">
            <input
              className="builder-title"
              placeholder="Workout name"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              onDoubleClick={() => {
                console.group('Workout Debug')
                console.log('Name:', workoutName)
                console.log('Exercises:', exercises)
                console.log('Blocks:', workoutBlocks)
                console.log('Payload:', buildPayload())
                console.groupEnd()
              }}
              title="Double-click to log workout JSON to console"
            />
            <div className="builder-toolbar-actions">
              <label className="builder-checkbox">
                <input
                  type="checkbox"
                  checked={condensedView}
                  onChange={(e) => setCondensedView(e.target.checked)}
                />
                Condensed view
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm builder-make-circuit"
                onClick={handleMakeCircuit}
                disabled={selectedExercises.size < 2}
              >
                Make Circuit ({selectedExercises.size})
              </button>
              <span className="builder-muted">{exercises.length} exercises</span>
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : isEditMode ? 'Update' : 'Save'}
              </button>
            </div>
          </div>

          {saveError ? (
            <div className="notice notice-error">{saveError}</div>
          ) : null}

          <div className="builder-canvas">
            {exercises.length === 0 ? (
              <div className="builder-empty">
                Select exercises from the library to build a plan.
              </div>
            ) : (
              <div className="builder-blocks">
                {workoutBlocks.map((block, blockIndex) => {
                  if (block.type === 'circuit') {
                    return (
                      <CircuitBlock
                        key={`circuit-${block.start}`}
                        block={block}
                        blockIndex={blockIndex}
                        condensed={condensedView}
                        onUndoCircuit={handleUndoCircuit}
                        onRemoveCircuit={handleRemoveCircuit}
                        onMoveCircuit={handleMoveCircuit}
                        onAddRound={handleAddRound}
                        onRemoveRound={handleRemoveRound}
                        onRemoveExercise={handleRemoveCircuitExercise}
                        onUpdateExercise={handleUpdateCircuitExercise}
                        onUpdateSet={handleUpdateCircuitSet}
                        totalBlocks={workoutBlocks.length}
                      />
                    )
                  }

                  // Single exercise
                  const exercise = block.exercise

                  return (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      index={block.index}
                      totalCount={exercises.length}
                      isSelected={selectedExercises.has(exercise.id)}
                      condensed={condensedView}
                      onToggleSelect={toggleSelectExercise}
                      onMove={moveExercise}
                      onRemove={removeExercise}
                      onUpdateExercise={updateExercise}
                      onUpdateSet={updateSet}
                      onAddSet={addSet}
                      onRemoveSet={removeSet}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </section>

      {showImport ? (
        <div className="builder-modal">
          <div className="builder-modal-card">
            <h3>Import Workout JSON</h3>
            <textarea
              placeholder="Paste JSON..."
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <div className="builder-modal-actions">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setShowImport(false)
                  setImportJson('')
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={handleImport}>
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDebug ? (
        <div className="builder-modal">
          <div className="builder-modal-card builder-modal-wide">
            <h3>Export Workout JSON</h3>
            <div className="builder-export-toggle">
              <button
                type="button"
                className={`btn btn-sm ${exportMode === 'condensed' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setExportMode('condensed')}
              >
                Condensed
              </button>
              <button
                type="button"
                className={`btn btn-sm ${exportMode === 'full' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setExportMode('full')}
              >
                Full
              </button>
            </div>
            <div className="builder-muted">
              {exportMode === 'condensed'
                ? 'Human-readable format — great for sharing with an LLM coach.'
                : 'Full format — use this to re-import into the Builder.'}
            </div>
            <textarea readOnly value={activeExport} />
            <div className="builder-modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setShowDebug(false)}>
                Close
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => navigator.clipboard.writeText(activeExport)}
              >
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
            <div className="builder-muted">
              Edit the instructions below freely, then click <strong>Append Exercises</strong> to attach the exercise list ({promptPool.length} exercises from current filters
              {promptPool.length > 200 ? ' — filter by category or equipment to narrow' : ''}).
              Paste the result into ChatGPT or Claude, then use Import JSON with the response.
            </div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
            <div className="builder-modal-actions">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setShowPrompt(false)
                  setPromptText(DEFAULT_PROMPT_TEMPLATE)
                }}
              >
                Close
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setPromptText(DEFAULT_PROMPT_TEMPLATE)}
              >
                Reset
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => navigator.clipboard.writeText(promptText)}
              >
                Copy
              </button>
              <button className="btn btn-primary" type="button" onClick={handleGeneratePrompt}>
                Append Exercises
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Builder
