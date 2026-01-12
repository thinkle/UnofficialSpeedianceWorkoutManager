const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Dart/3.9 (dart:io)',
  Timestamp: String(Date.now()),
  Utc_offset: '+0000',
  Versioncode: '40304',
  Mobiledevices:
    '{"brand":"google","device":"emulator64_x86_64_arm64","deviceType":"sdk_gphone64_x86_64","os":"","os_version":"31","manufacturer":"Google"}',
  Timezone: 'GMT',
  'Accept-Language': 'en',
  App_type: 'SOFTWARE',
  Connection: 'keep-alive',
  'Accept-Encoding': 'gzip, deflate, br',
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

  const { email, password, region } = payload
  if (!email || !password) {
    return jsonResponse(400, { ok: false, message: 'Email and password required.' })
  }

  const host = resolveHost(region)
  const baseUrl = `https://${host}`
  const headers = { ...DEFAULT_HEADERS, Host: host, Timestamp: String(Date.now()) }

  try {
    const verifyResponse = await fetch(`${baseUrl}/api/app/v2/login/verifyIdentity`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 2, userIdentity: email }),
    })

    const verifyJson = await verifyResponse.json().catch(() => null)
    if (!verifyResponse.ok || !verifyJson) {
      return jsonResponse(200, { ok: false, message: 'Account verification failed.' })
    }

    const verifyData = verifyJson.data || {}
    if (verifyData.isExist === false) {
      return jsonResponse(200, {
        ok: false,
        message: 'Account not found. Please register in the official app first.',
      })
    }

    if (verifyData.hasPwd === false) {
      return jsonResponse(200, {
        ok: false,
        message: 'Account has no password set. Please set one in the official app.',
      })
    }

    const loginResponse = await fetch(`${baseUrl}/api/app/v2/login/byPass`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userIdentity: email, password, type: 2 }),
    })

    const loginJson = await loginResponse.json().catch(() => null)
    if (!loginResponse.ok || !loginJson) {
      return jsonResponse(200, { ok: false, message: 'Login failed.' })
    }

    const data = loginJson.data || {}
    const token = data.token
    const userId = data.appUserId

    if (!token || !userId) {
      return jsonResponse(200, { ok: false, message: 'Token missing in response.' })
    }

    return jsonResponse(200, {
      ok: true,
      message: 'Login successful.',
      data: { token, userId, region },
    })
  } catch (error) {
    return jsonResponse(200, { ok: false, message: 'Unable to reach login service.' })
  }
}
