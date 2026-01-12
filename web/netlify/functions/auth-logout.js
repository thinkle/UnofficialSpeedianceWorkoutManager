const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Dart/3.9 (dart:io)',
  Timestamp: String(Date.now()),
  Versioncode: '40304',
  Mobiledevices:
    '{"brand":"google","device":"emulator64_x86_64_arm64","deviceType":"sdk_gphone64_x86_64","os":"","os_version":"31","manufacturer":"Google"}',
}

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

  const { token, userId, region } = payload
  if (!token) {
    return jsonResponse(200, { ok: true, message: 'No session to revoke.' })
  }

  const host = resolveHost(region)
  const baseUrl = `https://${host}`
  const headers = {
    ...DEFAULT_HEADERS,
    Host: host,
    App_user_id: userId || '',
    Token: token,
    Timestamp: String(Date.now()),
    App_type: 'SOFTWARE',
  }

  try {
    await fetch(`${baseUrl}/api/app/login/logout`, {
      method: 'POST',
      headers,
    })

    return jsonResponse(200, { ok: true })
  } catch (error) {
    return jsonResponse(200, { ok: false, message: 'Logout request failed.' })
  }
}
