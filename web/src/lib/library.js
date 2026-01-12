import {
  buildExerciseCacheKey,
  buildLibraryCacheKey,
  loadCache,
  saveCache,
} from './storage.js'
import { speedianceRequest } from './speedianceApi.js'

const DETAIL_BATCH_SIZE = 50

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
    } else {
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
        continue
      }

      const groups = response.data || []
      groups.forEach((group) => {
        const actions = group.actionLibraryGroupList || []
        actions.forEach((action) => {
          const entryAction = {
            ...action,
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

async function fetchBatchDetails(config, ids) {
  if (!ids.length) return []
  const response = await speedianceRequest({
    path: '/api/app/actionLibraryGroup/list',
    method: 'GET',
    query: { ids },
    config,
  })

  if (!response.ok) {
    throw new Error(response.error || 'Failed to fetch exercise details.')
  }

  return response.data || []
}

export async function fetchLibrary(config) {
  const cacheKey = buildLibraryCacheKey({
    region: config.region,
    deviceType: config.device_type,
    allowMonsterMoves: config.allow_monster_moves,
  })

  const cached = loadCache(cacheKey)
  if (cached) {
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
  const allIds = Array.from(uniqueMap.keys())
  const detailed = []

  for (let i = 0; i < allIds.length; i += DETAIL_BATCH_SIZE) {
    const chunk = allIds.slice(i, i + DETAIL_BATCH_SIZE)
    const details = await fetchBatchDetails(config, chunk)
    details.forEach((detail) => {
      const original = uniqueMap.get(detail.id)
      if (!original) return
      detail.category_id = original.category_id
      detail.category_name = original.category_name
      detail.device_type_list = original.device_type_list
      detail.device_type_tag = (original.device_type_list || [])
        .filter(Boolean)
        .join(',')
    })
    detailed.push(...details)
  }

  const payload = {
    exercises: detailed,
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
    return { ok: true, data: cached, source: 'cache' }
  }

  const response = await speedianceRequest({
    path: `/api/app/actionLibraryGroup/${exerciseId}`,
    method: 'GET',
    query: { isDisplay: 1 },
    config,
  })

  if (!response.ok) {
    return { ok: false, error: response.error || 'Unable to load exercise.' }
  }

  saveCache(cacheKey, response.data)
  return { ok: true, data: response.data, source: 'network' }
}
