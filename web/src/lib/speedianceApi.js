import { DEFAULT_CONFIG } from './storage.js'

const PROXY_ENDPOINT = '/.netlify/functions/speediance'

export async function speedianceRequest({
  path,
  method = 'GET',
  query,
  body,
  config,
}) {
  const safeConfig = { ...DEFAULT_CONFIG, ...(config || {}) }
  const response = await fetch(PROXY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      method,
      query,
      body,
      region: safeConfig.region,
      token: safeConfig.token,
      userId: safeConfig.user_id,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok === false) {
    return {
      ok: false,
      status: response.status,
      error: payload.message || 'Request failed.',
      unauthorized: Boolean(payload.unauthorized),
    }
  }

  return {
    ok: true,
    data: payload.data,
  }
}
