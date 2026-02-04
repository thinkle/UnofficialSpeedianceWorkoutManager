import { speedianceRequest } from './speedianceApi.js'

function extractFirstValue(data, keys) {
  if (!data || typeof data !== 'object') return null
  for (const key of keys) {
    const value = data[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return null
}

function parseHistoryDatetime(value) {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    const ts = value
    if (ts > 1e12) {
      return new Date(ts)
    }
    if (ts > 1e10) {
      return new Date(ts)
    }
    return new Date(ts * 1000)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d+$/.test(trimmed)) {
      const ts = Number(trimmed)
      if (ts > 1e12) return new Date(ts)
      if (ts > 1e10) return new Date(ts)
      return new Date(ts * 1000)
    }

    const isoCandidate = trimmed.replace(' ', 'T')
    const parsed = Date.parse(isoCandidate)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }
  }

  return null
}

function formatHistoryDatetime(value) {
  const dt = parseHistoryDatetime(value)
  if (!dt || Number.isNaN(dt.getTime())) return null
  const pad = (num) => String(num).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function formatNumber(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  if (Number.isInteger(num)) return String(num)
  return num.toFixed(1)
}

function formatDuration(entry) {
  const minuteKeys = [
    'durationMinute',
    'durationMinutes',
    'durationMin',
    'durationMins',
    'duration_min',
    'duration_mins',
    'totalMinutes',
    'totalMinute',
  ]
  const secondKeys = [
    'duration',
    'durationSeconds',
    'durationSec',
    'totalSeconds',
    'totalTime',
    'timeSeconds',
    'trainingTime',
  ]
  const minutes = extractFirstValue(entry, minuteKeys)
  if (minutes !== null) {
    return `${formatNumber(minutes)} min`
  }

  const seconds = extractFirstValue(entry, secondKeys)
  if (seconds === null) return null
  const value = Number(seconds)
  if (Number.isNaN(value)) return String(seconds)
  const secondsValue = value > 1e5 ? value / 1000 : value
  const minutesValue = secondsValue / 60
  if (minutesValue >= 1) {
    return `${formatNumber(minutesValue)} min`
  }
  return `${formatNumber(secondsValue)} sec`
}

function formatSecondsValue(value) {
  if (value === null || value === undefined) return null
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  const secondsValue = num > 1e5 ? num / 1000 : num
  const minutesValue = secondsValue / 60
  if (minutesValue >= 1) {
    return `${formatNumber(minutesValue)} min`
  }
  return `${formatNumber(secondsValue)} sec`
}

function summarizeWeightDetail(value) {
  if (!value) return null
  const parts = String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const weights = parts
    .map((part) => Number(part))
    .filter((num) => !Number.isNaN(num))
  if (!weights.length) return null
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  if (min === max) return formatNumber(min)
  return `${formatNumber(min)}-${formatNumber(max)}`
}

function extractHistoryEntries(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'object') {
    const candidates = ['data', 'items', 'result', 'workouts', 'history', 'entries', 'sessions', 'records']
    for (const key of candidates) {
      const value = payload[key]
      if (Array.isArray(value)) return value
      if (value && typeof value === 'object') {
        for (const innerKey of candidates) {
          const innerValue = value[innerKey]
          if (Array.isArray(innerValue)) return innerValue
        }
      }
    }
    return [payload]
  }
  return []
}

function flattenHistoryEntries(entries) {
  const listKeys = [
    'records',
    'recordList',
    'trainingList',
    'trainingInfoList',
    'items',
    'sessions',
    'workouts',
    'list',
  ]
  const flattened = []
  const sessionKeys = ['id', 'trainingId', 'startTimestamp', 'endTimestamp', 'trainingTime']

  entries.forEach((entry) => {
    let nested = null
    let dateHint = null
    if (entry && typeof entry === 'object') {
      dateHint = extractFirstValue(entry, ['date', 'day', 'trainingDate', 'recordDate'])
      for (const key of listKeys) {
        const value = entry[key]
        if (Array.isArray(value) && value.length) {
          const hasSessionItem = value.some(
            (item) => item && typeof item === 'object' && extractFirstValue(item, sessionKeys)
          )
          if (hasSessionItem || !extractFirstValue(entry, sessionKeys)) {
            nested = value
            break
          }
        }
      }
    }

    if (nested) {
      nested.forEach((item) => {
        if (item && typeof item === 'object' && dateHint) {
          flattened.push({ ...item, date: item.date || dateHint })
        } else {
          flattened.push(item)
        }
      })
    } else {
      flattened.push(entry)
    }
  })

  return flattened
}

function normalizeHistoryEntries(entries, unit) {
  const unitLabel = unit === 1 ? 'lbs' : 'kg'
  const normalized = entries.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return {
        title: String(entry),
        performed_at: null,
        device: null,
        metrics: [],
        raw_json: JSON.stringify(entry, null, 2),
        detail_id: null,
        sort_ts: 0,
      }
    }

    const title =
      extractFirstValue(entry, ['name', 'workoutName', 'templateName', 'planName', 'title']) || 'Workout'

    const performedAtValue = extractFirstValue(entry, [
      'completedAt',
      'completed_at',
      'finishTime',
      'finish_time',
      'endTime',
      'end_time',
      'endTimestamp',
      'startTime',
      'start_time',
      'createTime',
      'createdAt',
      'timestamp',
      'ts',
      'date',
      'day',
      'recordDate',
    ])
    const performedAt = formatHistoryDatetime(performedAtValue)
    const performedDate = parseHistoryDatetime(performedAtValue)
    const sortTs = performedDate ? performedDate.getTime() : 0

    const deviceType = extractFirstValue(entry, ['deviceType', 'device_type'])
    let deviceLabel = null
    if (deviceType !== null && deviceType !== undefined) {
      if (String(deviceType) === '1') deviceLabel = 'Device Type 1'
      else if (String(deviceType) === '2') deviceLabel = 'Device Type 2'
      else deviceLabel = String(deviceType)
    }

    const metrics = []
    const duration = formatDuration(entry)
    if (duration) metrics.push({ label: 'Duration', value: duration })

    const calories = extractFirstValue(entry, ['calories', 'calorie', 'kcal', 'burnCalories', 'burningCalories', 'totalCalories'])
    if (calories !== null) metrics.push({ label: 'Calories', value: `${formatNumber(calories)} kcal` })

    const volume = extractFirstValue(entry, ['totalCapacity', 'totalVolume', 'volume', 'totalWeight', 'totalWeights'])
    if (volume !== null) metrics.push({ label: 'Volume', value: `${formatNumber(volume)} ${unitLabel}` })

    let count = extractFirstValue(entry, [
      'actionNum',
      'exerciseCount',
      'movementCount',
      'setCount',
      'trainingCount',
      'actionTotalCount',
      'finishActionCount',
    ])

    if (count === null) {
      ['actions', 'actionList', 'exercises', 'exerciseList', 'sets'].some((key) => {
        if (Array.isArray(entry[key])) {
          count = entry[key].length
          return true
        }
        return false
      })
    }
    if (count !== null) metrics.push({ label: 'Exercises', value: formatNumber(count) })

    const sessionId = extractFirstValue(entry, ['sessionId', 'session_id', 'id', 'workoutId', 'trainingId'])
    if (sessionId !== null) metrics.push({ label: 'Session ID', value: String(sessionId) })

    const detailId = extractFirstValue(entry, ['trainingId', 'training_id', 'id'])

    return {
      title,
      performed_at: performedAt,
      device: deviceLabel,
      metrics,
      raw_json: JSON.stringify(entry, null, 2),
      detail_id: detailId,
      sort_ts: sortTs,
    }
  })

  normalized.sort((a, b) => (b.sort_ts || 0) - (a.sort_ts || 0))
  normalized.forEach((item) => delete item.sort_ts)
  return normalized
}

/**
 * Get a signature for a history exercise (using actionLibraryId for matching)
 */
function historyExerciseSignature(exercise) {
  return String(exercise.actionLibraryId || exercise.id || exercise.name)
}

/**
 * Detect a circuit pattern in history exercises starting at a given index
 */
function detectHistoryCircuitAtIndex(exercises, startIndex, maxCycle = 8) {
  const signatures = exercises.map(historyExerciseSignature)
  const remaining = exercises.length - startIndex
  const maxLen = Math.min(maxCycle, Math.floor(remaining / 2))

  for (let cycleLen = 2; cycleLen <= maxLen; cycleLen += 1) {
    const cycleSignatures = signatures.slice(startIndex, startIndex + cycleLen)
    const distinct = new Set(cycleSignatures)

    // Need at least 2 different exercises to form a circuit
    if (distinct.size < 2) continue

    // Check if the pattern repeats at least once
    let matches = true
    for (let i = 0; i < cycleLen; i += 1) {
      if (signatures[startIndex + i] !== signatures[startIndex + cycleLen + i]) {
        matches = false
        break
      }
    }
    if (!matches) continue

    // Count how many rounds we have
    let rounds = 2
    while (startIndex + (rounds + 1) * cycleLen <= exercises.length) {
      let roundMatches = true
      for (let i = 0; i < cycleLen; i += 1) {
        if (signatures[startIndex + i] !== signatures[startIndex + rounds * cycleLen + i]) {
          roundMatches = false
          break
        }
      }
      if (!roundMatches) break
      rounds += 1
    }

    return { cycleLen, rounds, length: cycleLen * rounds }
  }

  return null
}

/**
 * Build circuit blocks from history exercises
 * Groups exercises into circuits (supersets) and singles
 */
function buildHistoryBlocks(exercises, exerciseRows, maxCycle = 8) {
  const blocks = []
  let i = 0

  while (i < exercises.length) {
    const detected = detectHistoryCircuitAtIndex(exercises, i, maxCycle)
    if (detected) {
      // Build grouped exercises for the circuit
      // Each entry in circuitExercises is one unique exercise with all its rounds
      const circuitExercises = []
      for (let order = 0; order < detected.cycleLen; order += 1) {
        const roundData = []
        for (let round = 0; round < detected.rounds; round += 1) {
          const idx = i + round * detected.cycleLen + order
          roundData.push({
            exerciseRow: exerciseRows[idx],
            raw: exercises[idx],
            roundIndex: round,
          })
        }
        // Use the first occurrence's name/img for the circuit entry
        const firstExercise = exercises[i + order]
        circuitExercises.push({
          name: firstExercise.actionLibraryName || firstExercise.name || 'Exercise',
          img: firstExercise.img,
          rounds: roundData,
        })
      }

      blocks.push({
        type: 'circuit',
        rounds: detected.rounds,
        cycleLen: detected.cycleLen,
        exercises: circuitExercises,
      })
      i += detected.length
      continue
    }

    // Single exercise (not part of a circuit)
    blocks.push({
      type: 'single',
      exercise: exerciseRows[i],
      raw: exercises[i],
    })
    i += 1
  }

  return blocks
}

function normalizeDetail(detail, unit) {
  const unitLabel = unit === 1 ? 'lbs' : 'kg'
  const title = extractFirstValue(detail, ['templateName', 'name', 'title', 'workoutName']) || 'Workout'
  const startValue = extractFirstValue(detail, ['startTime', 'startTimestamp', 'start_time'])
  const endValue = extractFirstValue(detail, ['endTime', 'endTimestamp', 'end_time'])

  const metrics = []
  const duration = formatDuration(detail)
  if (duration) metrics.push({ label: 'Duration', value: duration })
  const calories = extractFirstValue(detail, ['calorie', 'calories'])
  if (calories !== null) metrics.push({ label: 'Calories', value: `${formatNumber(calories)} kcal` })
  const volume = extractFirstValue(detail, ['totalCapacity', 'totalVolume', 'totalWeight'])
  if (volume !== null) metrics.push({ label: 'Volume', value: `${formatNumber(volume)} ${unitLabel}` })
  const count = extractFirstValue(detail, ['trainingCount', 'actionTotalCount', 'finishActionCount'])
  if (count !== null) metrics.push({ label: 'Exercises', value: formatNumber(count) })

  const deviceType = extractFirstValue(detail, ['deviceType', 'device_type'])
  let deviceLabel = null
  if (deviceType !== null && deviceType !== undefined) {
    if (String(deviceType) === '1') deviceLabel = 'Device Type 1'
    else if (String(deviceType) === '2') deviceLabel = 'Device Type 2'
    else deviceLabel = String(deviceType)
  }

  const exercises =
    detail.cttActionLibraryTrainingInfoList ||
    detail.actionLibraryTrainingInfoList ||
    detail.actionList ||
    []

  const exerciseRows = exercises.map((exercise) => {
    if (!exercise || typeof exercise !== 'object') {
      return { name: String(exercise), metrics: [], sets: [] }
    }

    const name = extractFirstValue(exercise, ['actionLibraryName', 'name', 'title']) || 'Exercise'
    const rowMetrics = []
    const setRows = []

    let sets = extractFirstValue(exercise, ['finishGroupCount', 'setCount'])
    const repsList = exercise.finishedReps
    if (sets === null && Array.isArray(repsList)) {
      sets = repsList.length
    }
    if (sets !== null) rowMetrics.push({ label: 'Sets', value: formatNumber(sets) })

    const weight = extractFirstValue(exercise, ['weight', 'avgWeight', 'maxWeight', 'minWeight'])
    if (weight !== null) rowMetrics.push({ label: 'Weight', value: `${formatNumber(weight)} ${unitLabel}` })

    const exDuration = formatDuration(exercise)
    if (exDuration) rowMetrics.push({ label: 'Time', value: exDuration })

    const exCalories = extractFirstValue(exercise, ['calorie', 'calories'])
    if (exCalories !== null) rowMetrics.push({ label: 'Calories', value: `${formatNumber(exCalories)} kcal` })

    const exVolume = extractFirstValue(exercise, ['totalCapacity', 'capacity'])
    if (exVolume !== null) rowMetrics.push({ label: 'Volume', value: `${formatNumber(exVolume)} ${unitLabel}` })

    if (Array.isArray(repsList)) {
      repsList.forEach((rep) => {
        if (!rep || typeof rep !== 'object') return
        const repsDone = extractFirstValue(rep, ['finishedCount', 'reps', 'count'])
        const repsTarget = extractFirstValue(rep, ['targetCount', 'target', 'targetTrainingCount'])
        let repsDisplay = repsDone !== null ? formatNumber(repsDone) : '-'
        if (repsTarget !== null) {
          repsDisplay = `${repsDisplay}/${formatNumber(repsTarget)}`
        }

        const timeDisplay = formatSecondsValue(rep.time)
        const avgWeight = extractFirstValue(rep, ['avgWeight', 'weight'])
        const weightDetailSummary = avgWeight === null ? summarizeWeightDetail(rep.weightDetail) : null
        const avgWeightDisplay = avgWeight !== null
          ? `${formatNumber(avgWeight)} ${unitLabel}`
          : weightDetailSummary
            ? `${weightDetailSummary} ${unitLabel}`
            : null

        let capacity = extractFirstValue(rep, ['capacity', 'totalCapacity'])
        if (capacity !== null) {
          capacity = `${formatNumber(capacity)} ${unitLabel}`
        }

        setRows.push({
          index: rep.ix,
          reps: repsDisplay,
          time: timeDisplay,
          avg_weight: avgWeightDisplay,
          weight_detail: weightDetailSummary ? `${weightDetailSummary} ${unitLabel}` : null,
          capacity,
        })
      })
    }

    return {
      name,
      img: extractFirstValue(exercise, ['img', 'image', 'imageUrl']),
      metrics: rowMetrics,
      sets: setRows,
    }
  })

  // Build circuit blocks for display
  const blocks = buildHistoryBlocks(exercises, exerciseRows)

  return {
    title,
    start_time: formatHistoryDatetime(startValue),
    end_time: formatHistoryDatetime(endValue),
    device: deviceLabel,
    metrics,
    exercises: exerciseRows,
    blocks,
  }
}

export async function fetchHistoryRecords(config, startDate, endDate) {
  // The API treats endDate as exclusive (up to midnight at the start of that day).
  // To include workouts from the end date, we need to add one day.
  let adjustedEndDate = endDate
  if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    const endDateObj = new Date(endDate + 'T00:00:00')
    endDateObj.setDate(endDateObj.getDate() + 1)
    const pad = (num) => String(num).padStart(2, '0')
    adjustedEndDate = `${endDateObj.getFullYear()}-${pad(endDateObj.getMonth() + 1)}-${pad(endDateObj.getDate())}`
  }

  const response = await speedianceRequest({
    path: '/api/mobile/v2/report/userTrainingDataRecord',
    method: 'GET',
    query: { startDate, endDate: adjustedEndDate },
    config,
  })

  if (!response.ok) {
    return response
  }

  const payload = response.data
  const entries = normalizeHistoryEntries(
    flattenHistoryEntries(extractHistoryEntries(payload)),
    config.unit || 0
  )

  return {
    ok: true,
    data: entries,
    raw: payload,
    source: '/api/mobile/v2/report/userTrainingDataRecord',
  }
}

export async function fetchHistoryDetail(config, trainingId) {
  const tryPaths = [
    `/api/app/cttTrainingInfo/${trainingId}`,
    `/api/app/trainingInfo/cttTrainingInfo/${trainingId}`,
  ]

  let detail = null
  for (const path of tryPaths) {
    const response = await speedianceRequest({
      path,
      method: 'GET',
      config,
    })
    if (response.unauthorized) {
      return response
    }
    if (response.ok && response.data) {
      detail = response.data
      break
    }
  }

  if (!detail) {
    return { ok: false, error: 'No detail found.' }
  }

  return {
    ok: true,
    data: normalizeDetail(detail, config.unit || 0),
    raw: detail,
  }
}
