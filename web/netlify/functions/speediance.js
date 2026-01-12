const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Dart/3.9 (dart:io)',
  Versioncode: '40304',
  Mobiledevices:
    '{"brand":"google","device":"emulator64_x86_64_arm64","deviceType":"sdk_gphone64_x86_64","os":"","os_version":"31","manufacturer":"Google"}',
  App_type: 'SOFTWARE',
}

const ALLOWED_PATHS = new Set([
  '/api/app/actionLibraryTab/list',
  '/api/app/actionLibraryGroup/trainingPartGroup',
  '/api/app/actionLibraryGroup/list',
  '/api/app/actionLibraryGroup',
  '/api/app/v4/customTrainingTemplate/appPage',
  '/api/app/v3/customTrainingTemplate/detailByCode',
  '/api/app/v5/trainingCalendar/monthNew',
  '/api/app/templateReservation',
  '/api/app/accessories/list',
])

function resolveHost(region) {
  return region === 'EU' ? 'euapi.speediance.com' : 'api2.speediance.com'
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function buildQuery(query) {
  const params = new URLSearchParams()
  if (!query) return params
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)))
    } else {
      params.set(key, String(value))
    }
  })
  return params
}

function sanitizePath(rawPath) {
  if (!rawPath) return null
  if (rawPath.startsWith('/api/app/actionLibraryGroup/') && rawPath !== '/api/app/actionLibraryGroup/list') {
    return '/api/app/actionLibraryGroup'
  }
  return rawPath
}

function buildFullUrl(baseUrl, path, query) {
  const params = buildQuery(query)
  const queryString = params.toString()
  return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, message: 'Method not allowed.' })
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch (error) {
    return jsonResponse(400, { ok: false, message: 'Invalid JSON body.' })
  }

  const {
    path,
    method = 'GET',
    query,
    body,
    region,
    token,
    userId,
  } = payload

  if (!path) {
    return jsonResponse(400, { ok: false, message: 'Missing request path.' })
  }

  const normalizedPath = sanitizePath(path)
  if (!normalizedPath || !ALLOWED_PATHS.has(normalizedPath)) {
    return jsonResponse(403, { ok: false, message: 'Path not allowed.' })
  }

  const host = resolveHost(region)
  const baseUrl = `https://${host}`
  const headers = {
    ...DEFAULT_HEADERS,
    Host: host,
    Timestamp: String(Date.now()),
    Token: token || '',
    App_user_id: userId || '',
  }

  const targetPath = path.startsWith('/api/app/actionLibraryGroup/')
    ? path
    : normalizedPath
  const url = buildFullUrl(baseUrl, targetPath, query)

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    })

    let data
    try {
      data = await response.json()
    } catch (error) {
      data = null
    }

    if (data && data.code === 91) {
      return jsonResponse(200, { ok: false, unauthorized: true, message: 'Unauthorized.' })
    }

    if (!response.ok) {
      return jsonResponse(200, {
        ok: false,
        message: data?.msg || 'Request failed.',
        status: response.status,
      })
    }

    return jsonResponse(200, { ok: true, data: data?.data ?? data })
  } catch (error) {
    return jsonResponse(200, { ok: false, message: 'Upstream request failed.' })
  }
}
