import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '../lib/storage.js'
import { loginWithPassword, logoutRemote } from '../lib/speedianceAuth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [config, setConfig] = useState(loadConfig)

  const updateConfig = (partial) => {
    setConfig((current) => {
      const next = { ...current, ...partial }
      saveConfig(next)
      return next
    })
  }

  const clearAuth = () => {
    setConfig((current) => {
      const next = { ...DEFAULT_CONFIG, ...current, user_id: '', token: '' }
      saveConfig(next)
      return next
    })
  }

  const login = async ({ email, password, region }) => {
    const result = await loginWithPassword({ email, password, region })
    if (result.ok && result.data) {
      updateConfig({
        user_id: String(result.data.userId || ''),
        token: result.data.token || '',
        region: result.data.region || region || config.region,
      })
    }
    return result
  }

  const logout = async () => {
    await logoutRemote({
      token: config.token,
      userId: config.user_id,
      region: config.region,
    })

    clearAuth()
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleUnauthorized = () => {
      clearAuth()
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [])

  const value = useMemo(
    () => ({
      config,
      isAuthenticated: Boolean(config.token),
      updateConfig,
      login,
      logout,
      clearAuth,
    }),
    [config]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
