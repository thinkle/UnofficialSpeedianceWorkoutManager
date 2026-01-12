const AUTH_LOGIN_ENDPOINT = '/.netlify/functions/auth-login'
const AUTH_LOGOUT_ENDPOINT = '/.netlify/functions/auth-logout'

export async function loginWithPassword({ email, password, region }) {
  try {
    const response = await fetch(AUTH_LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, region }),
    })

    const data = await response.json()
    if (!response.ok || !data.ok) {
      return {
        ok: false,
        message: data?.message || 'Login failed. Please try again.',
      }
    }

    return {
      ok: true,
      message: data.message || 'Login successful',
      data: data.data,
    }
  } catch (error) {
    return {
      ok: false,
      message: 'Unable to reach the login service.',
    }
  }
}

export async function logoutRemote({ token, userId, region }) {
  if (!token) {
    return { ok: true }
  }

  try {
    const response = await fetch(AUTH_LOGOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId, region }),
    })

    const data = await response.json().catch(() => ({}))
    return { ok: response.ok && data.ok !== false }
  } catch (error) {
    return { ok: false }
  }
}
