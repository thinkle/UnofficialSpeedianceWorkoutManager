const STORAGE_KEY = 'workout-manager.config'

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
