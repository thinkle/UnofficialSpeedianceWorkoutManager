const STORAGE_KEY = 'workout-manager.config'
export const CACHE_PREFIX = 'workout-manager.cache.'

export const DEFAULT_CONFIG = {
  user_id: '',
  token: '',
  region: 'Global',
  unit: 0,
  custom_instruction: '',
  device_type: 1,
  allow_monster_moves: false,
}

export function loadConfig() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_CONFIG }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_CONFIG }
    }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch (error) {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function loadCache(key) {
  if (typeof window === 'undefined') return null
  const fullKey = `${CACHE_PREFIX}${key}`
  try {
    const raw = window.localStorage.getItem(fullKey)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}

export function saveCache(key, data) {
  if (typeof window === 'undefined') return
  const fullKey = `${CACHE_PREFIX}${key}`
  window.localStorage.setItem(fullKey, JSON.stringify(data))
}

export function buildLibraryCacheKey({ region, deviceType, allowMonsterMoves }) {
  const allowFlag = allowMonsterMoves ? 1 : 0
  return `library.${region}.device${deviceType}.allow${allowFlag}`
}

export function buildExerciseCacheKey({ region, deviceType, allowMonsterMoves, exerciseId }) {
  const allowFlag = allowMonsterMoves ? 1 : 0
  return `exercise.${region}.device${deviceType}.allow${allowFlag}.${exerciseId}`
}
