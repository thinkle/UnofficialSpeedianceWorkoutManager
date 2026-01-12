import { useEffect, useState } from 'react'
import { CACHE_PREFIX, DEFAULT_CONFIG } from '../lib/storage.js'
import { useAuth } from '../state/AuthContext.jsx'

const regionOptions = [
  { label: 'Global', value: 'Global' },
  { label: 'Europe', value: 'EU' },
]

function Settings() {
  const { config, isAuthenticated, login, logout, updateConfig } = useAuth()
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    region: config.region || DEFAULT_CONFIG.region,
  })
  const [manualForm, setManualForm] = useState({
    token: config.token || '',
    userId: config.user_id || '',
  })
  const [prefsForm, setPrefsForm] = useState({
    unit: String(config.unit ?? DEFAULT_CONFIG.unit),
    deviceType: String(config.device_type ?? DEFAULT_CONFIG.device_type),
    allowMonsterMoves: Boolean(config.allow_monster_moves),
  })
  const [status, setStatus] = useState(null)

  useEffect(() => {
    setLoginForm((current) => ({
      ...current,
      region: config.region || DEFAULT_CONFIG.region,
    }))
    setManualForm({
      token: config.token || '',
      userId: config.user_id || '',
    })
    setPrefsForm({
      unit: String(config.unit ?? DEFAULT_CONFIG.unit),
      deviceType: String(config.device_type ?? DEFAULT_CONFIG.device_type),
      allowMonsterMoves: Boolean(config.allow_monster_moves),
    })
  }, [config])

  const handleLoginSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)

    if (!loginForm.email || !loginForm.password) {
      setStatus({ type: 'error', message: 'Email and password are required.' })
      return
    }

    setStatus({ type: 'loading', message: 'Signing in...' })
    const result = await login({
      email: loginForm.email.trim(),
      password: loginForm.password,
      region: loginForm.region,
    })

    if (result.ok) {
      setStatus({ type: 'success', message: result.message || 'Connected.' })
      setLoginForm((current) => ({ ...current, password: '' }))
    } else {
      setStatus({ type: 'error', message: result.message || 'Login failed.' })
    }
  }

  const handleManualSave = () => {
    updateConfig({
      token: manualForm.token.trim(),
      user_id: manualForm.userId.trim(),
      region: loginForm.region,
    })
    setStatus({ type: 'success', message: 'Manual session saved locally.' })
  }

  const handlePreferencesSave = () => {
    updateConfig({
      unit: Number(prefsForm.unit),
      device_type: Number(prefsForm.deviceType),
      allow_monster_moves: Boolean(prefsForm.allowMonsterMoves),
    })
    setStatus({ type: 'success', message: 'Preferences updated.' })
  }

  const handleLogout = async () => {
    setStatus({ type: 'loading', message: 'Signing out...' })
    await logout()
    setStatus({ type: 'success', message: 'Signed out.' })
  }

  const handleCacheClear = () => {
    if (typeof window === 'undefined') return
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        window.localStorage.removeItem(key)
      }
    })
    setStatus({ type: 'success', message: 'Local cache cleared.' })
  }

  const statusClass = status?.type ? `notice notice-${status.type}` : 'notice'

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="page-title">Connect your account and tune preferences.</h1>
          <p className="page-subtitle">
            Credentials are passed through and stored only in this browser.
          </p>
        </div>
      </section>

      {status ? (
        <div className={statusClass} role="status">
          {status.message}
        </div>
      ) : null}

      <section className="grid-2">
        <div className="card">
          <h2 className="section-title">Account login</h2>
          <p className="page-subtitle">
            Use your existing training platform credentials to generate a session token.
          </p>
          {isAuthenticated ? (
            <div className="stack">
              <div className="highlight">
                <div className="highlight-title">Connected</div>
                <div className="highlight-copy">User ID: {config.user_id || 'Unknown'}</div>
              </div>
              <button className="btn btn-outline" type="button" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          ) : (
            <form className="form-grid" onSubmit={handleLoginSubmit}>
              <label className="form-field">
                <span>Region</span>
                <select
                  value={loginForm.region}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, region: event.target.value }))
                  }
                >
                  {regionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="form-field">
                <span>Password</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">
                  Sign in
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setLoginForm((current) => ({ ...current, email: '', password: '' }))}
                >
                  Reset
                </button>
              </div>
            </form>
          )}

          <details className="details">
            <summary>Manual session token</summary>
            <div className="form-grid">
              <label className="form-field">
                <span>Session token</span>
                <input
                  type="password"
                  value={manualForm.token}
                  onChange={(event) =>
                    setManualForm((current) => ({ ...current, token: event.target.value }))
                  }
                  placeholder="Paste token"
                />
              </label>
              <label className="form-field">
                <span>User ID</span>
                <input
                  type="text"
                  value={manualForm.userId}
                  onChange={(event) =>
                    setManualForm((current) => ({ ...current, userId: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" type="button" onClick={handleManualSave}>
                Save manual session
              </button>
            </div>
          </details>
        </div>

        <div className="card">
          <h2 className="section-title">Preferences</h2>
          <div className="form-grid">
            <label className="form-field">
              <span>Unit system</span>
              <select
                value={prefsForm.unit}
                onChange={(event) =>
                  setPrefsForm((current) => ({ ...current, unit: event.target.value }))
                }
              >
                <option value="0">Metric (kg)</option>
                <option value="1">Imperial (lb)</option>
              </select>
            </label>
            <label className="form-field">
              <span>Device type</span>
              <select
                value={prefsForm.deviceType}
                onChange={(event) =>
                  setPrefsForm((current) => ({ ...current, deviceType: event.target.value }))
                }
              >
                <option value="1">Device type 1</option>
                <option value="2">Device type 2</option>
              </select>
            </label>
            <label className="form-field">
              <span>Allow mixed device movements</span>
              <select
                value={prefsForm.allowMonsterMoves ? 'yes' : 'no'}
                onChange={(event) =>
                  setPrefsForm((current) => ({
                    ...current,
                    allowMonsterMoves: event.target.value === 'yes',
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="button" onClick={handlePreferencesSave}>
              Save preferences
            </button>
          </div>
        </div>
      </section>

      <section className="card callout">
        <div>
          <h2 className="section-title">Storage notice</h2>
          <p className="page-subtitle">
            No proprietary data is stored on any server. Clearing your browser storage fully removes cached
            sessions, media, and tokens.
          </p>
        </div>
        <button className="btn btn-outline" type="button" onClick={handleCacheClear}>
          Clear local cache
        </button>
      </section>
    </div>
  )
}

export default Settings
