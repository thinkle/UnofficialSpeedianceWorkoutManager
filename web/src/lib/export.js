export const PRESET_LABELS = {
  '-1': 'Custom',
  0: 'Custom',
  1: 'Gain Muscle',
  3: 'Stamina',
  5: 'Strength',
}

export const MODE_LABELS = {
  1: 'Standard',
  2: 'Chains',
  3: 'Eccentric',
}

function presetLabel(id) {
  return PRESET_LABELS[String(id)] ?? PRESET_LABELS[id] ?? 'Custom'
}

function modeLabel(mode) {
  return MODE_LABELS[parseInt(mode, 10)] ?? 'Standard'
}

/**
 * Condense a workout built in the Builder (exercises already normalised into
 * { title, category_name, equipment_name, mainMuscleGroupName, preset_id, sets[] }).
 */
export function condenseBuilderWorkout(name, exercises) {
  return {
    name,
    exercises: exercises.map((ex) => {
      const entry = { title: ex.title }
      if (ex.category_name) entry.category = ex.category_name
      if (ex.equipment_name) entry.equipment = ex.equipment_name
      if (ex.mainMuscleGroupName) entry.muscles = ex.mainMuscleGroupName
      const preset = presetLabel(ex.preset_id)
      if (preset !== 'Custom') entry.preset = preset
      entry.sets = (ex.sets || []).map((s) => {
        const set = { reps: s.reps, weight: s.weight }
        if (s.unit && s.unit !== 'reps') set.unit = s.unit
        const mode = modeLabel(s.mode)
        if (mode !== 'Standard') set.mode = mode
        return set
      })
      return entry
    }),
  }
}

/**
 * Condense a raw API workout detail object (actionLibraryList with comma-
 * separated setsAndReps / weights / sportMode strings).
 */
export function condenseApiWorkout(workout) {
  const exercises = (workout.actionLibraryList || []).map((action) => {
    const repsArr = (action.setsAndReps || '').split(',').filter(Boolean)
    const weightsArr = (action.weights || '').split(',').filter(Boolean)
    const modesArr = (action.sportMode || '').split(',').filter(Boolean)
    const cwArr = (action.counterweight2 || action.counterWeight2 || '').split(',').filter(Boolean)

    const rawPreset = action.templatePresetId
    const presetId = rawPreset === undefined || rawPreset === null || rawPreset === '' ? -1 : parseInt(rawPreset, 10)
    const isRM = presetId !== -1 && presetId !== 0

    const sets = repsArr.map((reps, i) => {
      const rawWeight = isRM && cwArr[i]
        ? parseInt(cwArr[i], 10)
        : Math.round(parseFloat(weightsArr[i] || 0))
      const set = { reps: parseInt(reps, 10) || 10, weight: rawWeight }
      const mode = modeLabel(parseInt(modesArr[i] || 1, 10))
      if (mode !== 'Standard') set.mode = mode
      return set
    })

    const title = action.name || action.titleEn || action.titleEN || action.title || 'Untitled'
    const entry = { title }
    const preset = presetLabel(presetId)
    if (preset !== 'Custom') entry.preset = preset
    entry.sets = sets
    return entry
  })

  return { name: workout.name || workout.title || 'Untitled', exercises }
}
