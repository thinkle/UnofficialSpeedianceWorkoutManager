import { speedianceRequest } from './speedianceApi.js'

function normalizeList(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  return (
    data.list ||
    data.records ||
    data.items ||
    data.rows ||
    data.data ||
    []
  )
}

export async function fetchWorkouts(config) {
  const response = await speedianceRequest({
    path: '/api/app/v4/customTrainingTemplate/appPage',
    method: 'GET',
    query: {
      pageNo: 1,
      pageSize: -1,
      deviceTypes: config.device_type,
    },
    config,
  })

  if (!response.ok) {
    return response
  }

  const workouts = normalizeList(response.data)
  return { ok: true, data: workouts }
}

export async function fetchCalendarMonth(config, dateStr) {
  const response = await speedianceRequest({
    path: '/api/app/v5/trainingCalendar/monthNew',
    method: 'GET',
    query: {
      date: dateStr,
      selectedDeviceType: config.device_type,
    },
    config,
  })

  if (!response.ok) {
    return response
  }

  return { ok: true, data: response.data || [] }
}

export async function scheduleWorkout(config, dateStr, templateCode, status) {
  const response = await speedianceRequest({
    path: '/api/app/templateReservation',
    method: 'POST',
    body: {
      status,
      deviceType: config.device_type,
      thatDay: dateStr,
      templateCode,
    },
    config,
  })

  if (!response.ok) {
    return response
  }

  return { ok: true, data: response.data }
}
