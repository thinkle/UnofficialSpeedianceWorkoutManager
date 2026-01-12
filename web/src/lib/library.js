import {
  buildExerciseCacheKey,
  buildLibraryCacheKey,
  loadCache,
  saveCache,
} from './storage.js'
import { speedianceRequest } from './speedianceApi.js'

const DEBUG = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV

function debugLog(message, data) {
  if (!DEBUG) return
  if (data !== undefined) {
    console.info(`[Library] ${message}`, data)
  } else {
    console.info(`[Library] ${message}`)
  }
}

function debugError(message, data) {
  if (!DEBUG) return
  if (data !== undefined) {
    console.error(`[Library] ${message}`, data)
  } else {
    console.error(`[Library] ${message}`)
  }
}

function normalizeCategoryName(name) {
  return (name || '').trim().toLowerCase()
}

function mergeCategories(categoriesByDevice) {
  const merged = new Map()

  categoriesByDevice.forEach((entry) => {
    const deviceType = entry.deviceType
    entry.categories.forEach((category) => {
      const key = normalizeCategoryName(category.name)
      if (!key) return
      if (!merged.has(key)) {
        merged.set(key, {
          id: category.id,
          name: category.name,
          filter_ids: [category.id],
        })
      } else {
        const current = merged.get(key)
        if (!current.filter_ids.includes(category.id)) {
          current.filter_ids.push(category.id)
        }
      }

      category.deviceType = deviceType
    })
  })

  return Array.from(merged.values()).map((category) => ({
    ...category,
    filter_ids: category.filter_ids.join(','),
  }))
}

async function fetchCategories(config, deviceTypes) {
  const results = []
  for (const deviceType of deviceTypes) {
    const response = await speedianceRequest({
      path: '/api/app/actionLibraryTab/list',
      method: 'GET',
      query: { deviceType },
      config,
    })
    if (response.ok) {
      results.push({ deviceType, categories: response.data || [] })
      debugLog('Loaded categories', { deviceType, count: response.data?.length || 0 })
    } else {
      debugError('Failed to load categories', { deviceType, response })
      if (response.unauthorized) {
        const error = new Error('Unauthorized.')
        error.code = 'UNAUTHORIZED'
        throw error
      }
      throw new Error(response.error || 'Failed to load categories.')
    }
  }
  return results
}

async function fetchLibraryGroups(config, categoriesByDevice) {
  const allExercises = []

  for (const entry of categoriesByDevice) {
    const deviceType = entry.deviceType
    for (const category of entry.categories) {
      const response = await speedianceRequest({
        path: '/api/app/actionLibraryGroup/trainingPartGroup',
        method: 'GET',
        query: {
          tabId: category.id,
          deviceTypeList: deviceType,
        },
        config,
      })

      if (!response.ok) {
        debugError('Failed to load training groups', {
          deviceType,
          tabId: category.id,
          response,
        })
        continue
      }

      const groups = response.data || []
      debugLog('Loaded training groups', {
        deviceType,
        tabId: category.id,
        groups: groups.length,
      })
      groups.forEach((group) => {
        const actions = group.actionLibraryGroupList || []
        actions.forEach((action) => {
          const title =
            action.title ||
            action.actionName ||
            action.name ||
            action.actionNameEn ||
            action.actionNameCn
          const entryAction = {
            ...action,
            title: title || action.title,
            category_id: category.id,
            category_name: category.name,
            device_type: deviceType,
          }
          allExercises.push(entryAction)
        })
      })
    }
  }

  return allExercises
}

function dedupeExercises(rawExercises) {
  const unique = new Map()

  rawExercises.forEach((exercise) => {
    const id = exercise.id
    if (!id) return
    if (!unique.has(id)) {
      unique.set(id, {
        ...exercise,
        device_type_list: [exercise.device_type],
      })
    } else {
      const existing = unique.get(id)
      const list = new Set(existing.device_type_list || [])
      list.add(exercise.device_type)
      existing.device_type_list = Array.from(list).filter(Boolean).sort()
    }
  })

  return unique
}

export async function fetchLibrary(config) {
  debugLog('Fetch library start', {
    region: config.region,
    deviceType: config.device_type,
    allowMonsterMoves: config.allow_monster_moves,
  })
  const cacheKey = buildLibraryCacheKey({
    region: config.region,
    deviceType: config.device_type,
    allowMonsterMoves: config.allow_monster_moves,
  })

  const cached = loadCache(cacheKey)
  if (cached) {
    debugLog('Library cache hit', { exercises: cached.exercises?.length || 0 })
    return { ok: true, data: cached, source: 'cache' }
  }

  const deviceTypes =
    config.device_type === 2 && config.allow_monster_moves ? [2, 1] : [config.device_type]

  const categoriesByDevice = await fetchCategories(config, deviceTypes)
  const categories =
    config.device_type === 2 && config.allow_monster_moves
      ? mergeCategories(categoriesByDevice)
      : categoriesByDevice[0]?.categories?.map((category) => ({
          ...category,
          filter_ids: String(category.id),
        })) || []

  const rawExercises = await fetchLibraryGroups(config, categoriesByDevice)
  const uniqueMap = dedupeExercises(rawExercises)
  const exercises = Array.from(uniqueMap.values()).map((exercise) => ({
    ...exercise,
    device_type_tag: (exercise.device_type_list || []).filter(Boolean).join(','),
  }))
  debugLog('Library dedupe complete', {
    raw: rawExercises.length,
    unique: exercises.length,
  })

  const payload = {
    exercises,
    categories,
    fetchedAt: new Date().toISOString(),
  }

  saveCache(cacheKey, payload)

  return { ok: true, data: payload, source: 'network' }
}

export async function fetchExerciseDetail(config, exerciseId) {
  if (!exerciseId) {
    return { ok: false, error: 'Missing exercise ID.' }
  }

  const cacheKey = buildExerciseCacheKey({
    region: config.region,
    deviceType: config.device_type,
    allowMonsterMoves: config.allow_monster_moves,
    exerciseId,
  })
  const cached = loadCache(cacheKey)
  if (cached) {
    debugLog('Exercise cache hit', { exerciseId })
    return { ok: true, data: cached, source: 'cache' }
  }

  const response = await speedianceRequest({
    path: `/api/app/actionLibraryGroup/${exerciseId}`,
    method: 'GET',
    query: { isDisplay: 1 },
    config,
  })

  if (!response.ok) {
    debugError('Failed to load exercise detail', { exerciseId, response })
    if (response.unauthorized) {
      return { ok: false, unauthorized: true, error: 'Unauthorized.' }
    }
    return { ok: false, error: response.error || 'Unable to load exercise.' }
  }

  debugLog('Loaded exercise detail', { exerciseId })
  saveCache(cacheKey, response.data)
  return { ok: true, data: response.data, source: 'network' }
}
