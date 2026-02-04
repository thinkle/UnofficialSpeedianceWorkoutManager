/**
 * Circuit detection and manipulation utilities.
 * Ported from legacy-python/static/js/circuits.js
 */

/**
 * Get a signature for an exercise (used for pattern matching)
 */
export function exerciseSignature(exercise) {
  return String(exercise.groupId)
}

/**
 * Deep clone an exercise, generating a new internal ID
 */
export function cloneExercise(exercise) {
  const cloned = JSON.parse(JSON.stringify(exercise))
  if (cloned && Object.prototype.hasOwnProperty.call(cloned, 'id')) {
    cloned.id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
  return cloned
}

/**
 * Check if two segments of signatures match
 */
function segmentMatches(signatures, startA, startB, len) {
  for (let i = 0; i < len; i += 1) {
    if (signatures[startA + i] !== signatures[startB + i]) return false
  }
  return true
}

/**
 * Detect a circuit pattern starting at a given index
 * Returns { cycleLen, rounds, length } if found, null otherwise
 */
export function detectCircuitAtIndex(data, startIndex, maxCycle = 8) {
  const signatures = data.map(exerciseSignature)
  const remaining = data.length - startIndex
  const maxLen = Math.min(maxCycle, Math.floor(remaining / 2))

  for (let cycleLen = 2; cycleLen <= maxLen; cycleLen += 1) {
    const cycleSignatures = signatures.slice(startIndex, startIndex + cycleLen)
    const distinct = new Set(cycleSignatures)

    // Need at least 2 different exercises to form a circuit
    if (distinct.size < 2) {
      continue
    }

    // Check if the pattern repeats at least once
    if (!segmentMatches(signatures, startIndex, startIndex + cycleLen, cycleLen)) {
      continue
    }

    // Count how many rounds we have
    let rounds = 2
    while (startIndex + (rounds + 1) * cycleLen <= data.length) {
      if (!segmentMatches(signatures, startIndex, startIndex + rounds * cycleLen, cycleLen)) {
        break
      }
      rounds += 1
    }

    return { cycleLen, rounds, length: cycleLen * rounds }
  }

  return null
}

/**
 * Build condensed blocks from a workout array
 * Returns an array of blocks: { type: 'circuit', start, cycleLen, rounds, length } or { type: 'single', index }
 */
export function buildCondensedBlocks(data, maxCycle = 8) {
  const blocks = []
  let i = 0

  while (i < data.length) {
    const detected = detectCircuitAtIndex(data, i, maxCycle)
    if (detected) {
      blocks.push({ type: 'circuit', start: i, ...detected })
      i += detected.length
      continue
    }
    blocks.push({ type: 'single', index: i })
    i += 1
  }

  return blocks
}

/**
 * Build circuit exercises array from workout data
 * Returns array of arrays: each inner array contains all instances of that exercise across rounds
 */
function buildCircuitExercises(workout, start, cycleLen, rounds) {
  const exercises = []
  for (let order = 0; order < cycleLen; order += 1) {
    const entries = []
    for (let round = 0; round < rounds; round += 1) {
      const idx = start + round * cycleLen + order
      entries.push(workout[idx])
    }
    exercises.push(entries)
  }
  return exercises
}

/**
 * Parse workout into blocks with full exercise data
 */
export function parseWorkoutBlocks(workout, maxCycle = 8) {
  const blocks = []
  let i = 0

  while (i < workout.length) {
    const detected = detectCircuitAtIndex(workout, i, maxCycle)
    if (detected) {
      const exercises = buildCircuitExercises(workout, i, detected.cycleLen, detected.rounds)
      blocks.push({
        type: 'circuit',
        start: i,
        cycleLen: detected.cycleLen,
        rounds: detected.rounds,
        length: detected.length,
        exercises,
      })
      i += detected.length
      continue
    }
    blocks.push({ type: 'single', exercise: workout[i], index: i })
    i += 1
  }

  return blocks
}

/**
 * Flatten circuit exercises back to a linear array
 */
function flattenCircuitExercises(exercises) {
  if (!exercises.length) return []
  const rounds = exercises[0].length
  const cycleLen = exercises.length
  const flattened = []

  for (let round = 0; round < rounds; round += 1) {
    for (let order = 0; order < cycleLen; order += 1) {
      flattened.push(exercises[order][round])
    }
  }

  return flattened
}

/**
 * Flatten blocks back to a workout array
 */
export function flattenBlocks(blocks) {
  const workout = []

  blocks.forEach((block) => {
    if (block.type === 'circuit') {
      workout.push(...flattenCircuitExercises(block.exercises))
    } else if (block.type === 'single') {
      workout.push(block.exercise)
    }
  })

  return workout
}

/**
 * Clone an exercise with a specific set group
 */
function cloneExerciseWithSetGroup(exercise, group) {
  const clone = cloneExercise(exercise)
  clone.sets = (group || []).map((set) => ({ ...set }))
  return clone
}

/**
 * Get set groups for an exercise (handles unilateral exercises)
 */
function getSetGroupsForExercise(exercise) {
  const sets = Array.isArray(exercise.sets) ? exercise.sets : []
  if (!exercise.isUnilateral) {
    return sets.map((set) => [set])
  }
  const groups = []
  for (let i = 0; i < sets.length; i += 2) {
    groups.push(sets.slice(i, i + 2))
  }
  return groups
}

/**
 * Build a circuit from an array of exercises
 * Interleaves the exercises based on their sets
 */
export function buildCircuitFromExercises(exercises) {
  if (!Array.isArray(exercises) || exercises.length === 0) return []

  const grouped = exercises.map(getSetGroupsForExercise)
  const maxRounds = Math.max(...grouped.map((groups) => groups.length))
  const interleaved = []

  for (let round = 0; round < maxRounds; round += 1) {
    for (let i = 0; i < exercises.length; i += 1) {
      const groups = grouped[i]
      const group = groups[round] || groups[groups.length - 1]
      if (!group) continue
      interleaved.push(cloneExerciseWithSetGroup(exercises[i], group))
    }
  }

  return interleaved
}

/**
 * Replace selected exercises with a circuit
 */
export function replaceExercisesWithCircuit(workout, indexes) {
  if (!Array.isArray(indexes) || indexes.length === 0) return workout.slice()

  const ordered = indexes.slice().sort((a, b) => a - b)
  const exercises = ordered.map((idx) => workout[idx]).filter(Boolean)
  if (exercises.length === 0) return workout.slice()

  const circuit = buildCircuitFromExercises(exercises)
  const indexSet = new Set(ordered)
  const filtered = workout.filter((_, idx) => !indexSet.has(idx))
  const insertAt = Math.max(0, Math.min(...ordered))

  return filtered.slice(0, insertAt).concat(circuit, filtered.slice(insertAt))
}

/**
 * Undo a circuit back to individual exercises
 */
export function undoCircuit(workout, blockIndex) {
  const blocks = parseWorkoutBlocks(workout)
  const block = blocks[blockIndex]

  if (!block || block.type !== 'circuit') return workout.slice()

  const rebuiltExercises = block.exercises
    .map((group) => {
      const base = group[0]
      if (!base) return null

      const combinedSets = []
      group.forEach((entry) => {
        ;(entry.sets || []).forEach((set) => combinedSets.push({ ...set }))
      })

      const clone = cloneExercise(base)
      clone.sets = combinedSets
      return clone
    })
    .filter(Boolean)

  const replacement = rebuiltExercises.map((exercise) => ({ type: 'single', exercise }))
  blocks.splice(blockIndex, 1, ...replacement)

  return flattenBlocks(blocks)
}

/**
 * Append a new exercise onto a circuit
 */
export function appendOntoCircuit(workout, circuitIndex, exercise) {
  const blocks = parseWorkoutBlocks(workout)
  const block = blocks[circuitIndex]

  if (!block || block.type !== 'circuit') return workout.slice()

  const rounds = block.exercises[0]?.length || 0
  const appended = block.exercises.slice()
  const newColumn = []

  for (let round = 0; round < rounds; round += 1) {
    newColumn.push(cloneExercise(exercise))
  }

  appended.push(newColumn)
  block.exercises = appended

  return flattenBlocks(blocks)
}

/**
 * Delete a round from a circuit
 */
export function deleteSetFromCircuit(workout, circuitIndex, roundIndex) {
  const blocks = parseWorkoutBlocks(workout)
  const block = blocks[circuitIndex]

  if (!block || block.type !== 'circuit') return workout.slice()

  const trimmed = block.exercises.map((group) => {
    const next = group.slice()
    if (roundIndex >= 0 && roundIndex < next.length) {
      next.splice(roundIndex, 1)
    }
    return next
  })

  const hasAny = trimmed.some((group) => group.length > 0)
  if (!hasAny) {
    blocks.splice(circuitIndex, 1)
  } else {
    block.exercises = trimmed
  }

  return flattenBlocks(blocks)
}

/**
 * Append a round to a circuit
 */
export function appendSetToCircuit(workout, circuitIndex) {
  const blocks = parseWorkoutBlocks(workout)
  const block = blocks[circuitIndex]

  if (!block || block.type !== 'circuit') return workout.slice()

  const next = block.exercises.map((group) => {
    const cloneSource = group[group.length - 1]
    const clone = cloneSource ? cloneExercise(cloneSource) : null
    return clone ? group.concat([clone]) : group.slice()
  })

  block.exercises = next
  return flattenBlocks(blocks)
}

/**
 * Delete an exercise from a circuit
 */
export function deleteExerciseFromCircuit(workout, circuitIndex, exerciseIndex) {
  const blocks = parseWorkoutBlocks(workout)
  const block = blocks[circuitIndex]

  if (!block || block.type !== 'circuit') return workout.slice()
  if (exerciseIndex < 0 || exerciseIndex >= block.exercises.length) return workout.slice()

  const trimmed = block.exercises.slice()
  trimmed.splice(exerciseIndex, 1)

  if (trimmed.length === 0) {
    blocks.splice(circuitIndex, 1)
  } else {
    block.exercises = trimmed
  }

  return flattenBlocks(blocks)
}

/**
 * Remove an entire circuit
 */
export function removeCircuit(workout, blockIndex) {
  const blocks = parseWorkoutBlocks(workout)
  const block = blocks[blockIndex]

  if (!block || block.type !== 'circuit') return workout.slice()

  blocks.splice(blockIndex, 1)
  return flattenBlocks(blocks)
}

/**
 * Move a circuit/block to a new position
 */
export function moveCircuit(workout, fromIndex, toIndex) {
  const blocks = parseWorkoutBlocks(workout)

  if (fromIndex < 0 || fromIndex >= blocks.length) return workout.slice()

  const clamped = Math.max(0, Math.min(toIndex, blocks.length - 1))
  const [moved] = blocks.splice(fromIndex, 1)
  blocks.splice(clamped, 0, moved)

  return flattenBlocks(blocks)
}

/**
 * Reorder exercises within a circuit
 */
export function reorderCircuitItems(workout, circuitIndex, fromPos, toPos) {
  const blocks = parseWorkoutBlocks(workout)
  const block = blocks[circuitIndex]

  if (!block || block.type !== 'circuit') return workout.slice()
  if (fromPos < 0 || fromPos >= block.exercises.length) return workout.slice()
  if (toPos < 0 || toPos >= block.exercises.length) return workout.slice()

  const reordered = block.exercises.slice()
  const [moved] = reordered.splice(fromPos, 1)
  reordered.splice(toPos, 0, moved)
  block.exercises = reordered

  return flattenBlocks(blocks)
}

/**
 * Map a workout index to circuit coordinates
 */
export function workoutIndexToCircuitIndex(workout, workoutIndex) {
  const result = {
    workoutIndex,
    isCircuit: false,
    blockIndex: null,
    circuitIndex: null,
    exerciseIndex: null,
    roundIndex: null,
    cycleLen: null,
    rounds: null,
    start: null,
  }

  if (!Array.isArray(workout) || workoutIndex < 0 || workoutIndex >= workout.length) {
    return result
  }

  const blocks = buildCondensedBlocks(workout)

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex]

    if (block.type === 'circuit') {
      const start = block.start
      const end = start + block.length

      if (workoutIndex >= start && workoutIndex < end) {
        const offset = workoutIndex - start
        return {
          workoutIndex,
          isCircuit: true,
          blockIndex,
          circuitIndex: blockIndex,
          exerciseIndex: offset % block.cycleLen,
          roundIndex: Math.floor(offset / block.cycleLen),
          cycleLen: block.cycleLen,
          rounds: block.rounds,
          start,
        }
      }
      continue
    }

    if (block.index === workoutIndex) {
      return {
        workoutIndex,
        isCircuit: false,
        blockIndex,
        circuitIndex: blockIndex,
        exerciseIndex: null,
        roundIndex: null,
        cycleLen: null,
        rounds: null,
        start: block.index,
      }
    }
  }

  return result
}
