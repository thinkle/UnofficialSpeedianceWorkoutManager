/**
 * Preset rules for workout configuration.
 * Maps preset IDs to their configuration rules.
 *
 * Preset IDs:
 *  -1: Custom (manual weight in KG)
 *   1: Gain Muscle / Hypertrophy (12 reps at 13RM)
 *   3: Stamina / Endurance (15 reps at 17RM)
 *   5: Strength (6 reps at 7RM)
 */

export const PRESET_RULES = {
  '-1': {
    // Custom
    id: -1,
    name: 'Custom',
    label: 'KG',
    step: 1,
    defW: 10,
    minW: 1,
    maxW: 100,
    defR: 10,
    minR: 1,
    maxR: 99,
    defRest: 60,
    minRest: 0,
    maxRest: 300,
  },
  '1': {
    // Gain Muscle / Hypertrophy
    id: 1,
    name: 'Gain Muscle',
    label: 'RM',
    step: 1,
    defW: 13,
    minW: 9,
    maxW: 13,
    defR: 12,
    minR: 8,
    maxR: 12,
    defRest: 60,
    minRest: 45,
    maxRest: 120,
  },
  '3': {
    // Stamina / Endurance
    id: 3,
    name: 'Stamina',
    label: 'RM',
    step: 1,
    defW: 17,
    minW: 15,
    maxW: 20,
    defR: 15,
    minR: 13,
    maxR: 20,
    defRest: 45,
    minRest: 30,
    maxRest: 180,
  },
  '5': {
    // Strength
    id: 5,
    name: 'Strength',
    label: 'RM',
    step: 1,
    defW: 7,
    minW: 4,
    maxW: 9,
    defR: 6,
    minR: 2,
    maxR: 8,
    defRest: 90,
    minRest: 60,
    maxRest: 180,
  },
}

/**
 * Get preset rules for a given preset ID
 */
export function getPresetRules(presetId) {
  const key = String(presetId)
  return PRESET_RULES[key] || PRESET_RULES['-1']
}

/**
 * Check if a preset uses RM (rep max) mode
 */
export function isRMPreset(presetId) {
  return presetId !== -1 && presetId !== '-1'
}

/**
 * Get the weight label for a preset ('KG' or 'RM')
 */
export function getWeightLabel(presetId) {
  const rules = getPresetRules(presetId)
  return rules.label
}

/**
 * Clamp a value within preset rules
 */
export function clampToRules(value, field, presetId) {
  const rules = getPresetRules(presetId)

  switch (field) {
    case 'reps':
      return Math.max(rules.minR, Math.min(rules.maxR, value))
    case 'weight':
      return Math.max(rules.minW, Math.min(rules.maxW, value))
    case 'rest':
      return Math.max(rules.minRest, Math.min(rules.maxRest, value))
    default:
      return value
  }
}

/**
 * Create a default set based on preset rules
 */
export function createDefaultSetFromPreset(presetId) {
  const rules = getPresetRules(presetId)
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reps: rules.defR,
    weight: rules.defW,
    rest: rules.defRest,
    mode: 1, // Standard mode
    unit: 'reps',
  }
}

/**
 * Apply preset rules to existing sets when changing presets
 * Resets reps and weight to the preset defaults for a clean transition
 */
export function applyPresetToSets(sets, newPresetId) {
  const rules = getPresetRules(newPresetId)

  return sets.map((set) => ({
    ...set,
    reps: rules.defR, // Reset reps to preset default
    weight: rules.defW, // Reset weight to preset default
    rest: clampToRules(set.rest, 'rest', newPresetId),
  }))
}

/**
 * Preset options for UI dropdowns
 */
export const PRESET_OPTIONS = [
  { id: -1, name: 'Custom', suffix: 'KG' },
  { id: 1, name: 'Gain Muscle', suffix: 'RM' },
  { id: 3, name: 'Stamina', suffix: 'RM' },
  { id: 5, name: 'Strength', suffix: 'RM' },
]

/**
 * Mode options for set training modes
 */
export const MODE_OPTIONS = [
  { id: 1, name: 'Standard' },
  { id: 2, name: 'Chains' },
  { id: 3, name: 'Eccentric' },
]

/**
 * Get mode name by ID
 */
export function getModeName(modeId) {
  const mode = MODE_OPTIONS.find((m) => m.id === modeId)
  return mode ? mode.name : 'Standard'
}
