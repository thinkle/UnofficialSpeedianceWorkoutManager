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

function pickExerciseTitle(record) {
  const candidates = [
    record?.titleEn,
    record?.titleEN,
    record?.actionNameEn,
    record?.actionNameEN,
    record?.nameEn,
    record?.nameEN,
    record?.title,
    record?.actionName,
    record?.name,
    record?.actionNameCn,
    record?.actionNameCN,
  ]

  return candidates.find((value) => typeof value === 'string' && value.trim()) || ''
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
          name: category.displayName || category.name,
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
      const categories = (response.data || []).map((category) => ({
        ...category,
        displayName: category.nameEn || category.nameEN || category.name,
      }))
      results.push({ deviceType, categories })
      debugLog('Loaded categories', { deviceType, count: categories.length })
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

async function fetchAccessoryMap(config) {
  const response = await speedianceRequest({
    path: '/api/app/accessories/list',
    method: 'GET',
    config,
  })
  if (!response.ok) {
    debugError('Failed to load accessories', { response })
    return {}
  }
  const accessories = response.data || []
  const map = {}
  accessories.forEach((acc) => {
    if (acc.id != null) {
      map[String(acc.id)] = acc.nameEn || acc.nameEN || acc.name || String(acc.id)
    }
  })
  debugLog('Loaded accessories', { count: accessories.length })
  return map
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
          const title = pickExerciseTitle(action)
          const entryAction = {
            ...action,
            title: title || action.title,
            category_id: category.id,
            category_name: category.displayName || category.name,
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

  const [rawExercises, accessoryMap] = await Promise.all([
    fetchLibraryGroups(config, categoriesByDevice),
    fetchAccessoryMap(config),
  ])
  const uniqueMap = dedupeExercises(rawExercises)
  const exercises = Array.from(uniqueMap.values()).map((exercise) => {
    const accIds = String(exercise.accessories || '').split(',').filter(Boolean)
    const accNames = accIds.map((id) => accessoryMap[id]).filter(Boolean)
    const equipment_name = accNames.length > 0 ? accNames.join(', ') : 'Standard'
    return {
      ...exercise,
      device_type_tag: (exercise.device_type_list || []).filter(Boolean).join(','),
      equipment_name,
    }
  })
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

  const raw = response.data
  const enriched = { ...raw }

  if (!enriched.category_name && enriched.tabName) {
    enriched.category_name = enriched.tabName
  }

  if (!enriched.equipment_name) {
    const accIds = String(enriched.accessories || '').split(',').filter(Boolean)
    if (accIds.length > 0) {
      const accessoryMap = await fetchAccessoryMap(config)
      const accNames = accIds.map((id) => accessoryMap[id]).filter(Boolean)
      enriched.equipment_name = accNames.length > 0 ? accNames.join(', ') : 'Standard'
    } else {
      enriched.equipment_name = 'Standard'
    }
  }

  debugLog('Loaded exercise detail', { exerciseId, equipment_name: enriched.equipment_name, category_name: enriched.category_name })
  saveCache(cacheKey, enriched)
  return { ok: true, data: enriched, source: 'network' }
}

export async function fetchExerciseDetailsBatch(config, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: true, data: {} }
  }

  const detailMap = {}
  const missing = []

  ids.forEach((exerciseId) => {
    const cacheKey = buildExerciseCacheKey({
      region: config.region,
      deviceType: config.device_type,
      allowMonsterMoves: config.allow_monster_moves,
      exerciseId,
    })
    const cached = loadCache(cacheKey)
    if (cached) {
      detailMap[exerciseId] = cached
    } else {
      missing.push(exerciseId)
    }
  })

  if (missing.length === 0) {
    return { ok: true, data: detailMap, source: 'cache' }
  }

  const response = await speedianceRequest({
    path: '/api/app/actionLibraryGroup/list',
    method: 'GET',
    query: { ids: missing },
    config,
  })

  if (!response.ok) {
    return response
  }

  const details = response.data || []
  details.forEach((detail) => {
    if (!detail?.id) return
    const cacheKey = buildExerciseCacheKey({
      region: config.region,
      deviceType: config.device_type,
      allowMonsterMoves: config.allow_monster_moves,
      exerciseId: detail.id,
    })
    saveCache(cacheKey, detail)
    detailMap[detail.id] = detail
  })

  return { ok: true, data: detailMap, source: 'network' }
}
