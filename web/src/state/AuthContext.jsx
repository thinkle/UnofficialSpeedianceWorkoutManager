import { createContext, useContext, useMemo, useState } from 'react'
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '../lib/storage.js'
import { loginWithPassword, logoutRemote } from '../lib/speedianceAuth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [config, setConfig] = useState(loadConfig)

  const updateConfig = (partial) => {
    const next = { ...config, ...partial }
    setConfig(next)
    saveConfig(next)
    return next
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

    updateConfig({
      user_id: '',
      token: '',
      region: config.region || DEFAULT_CONFIG.region,
      unit: config.unit ?? DEFAULT_CONFIG.unit,
      device_type: config.device_type ?? DEFAULT_CONFIG.device_type,
      allow_monster_moves: config.allow_monster_moves ?? DEFAULT_CONFIG.allow_monster_moves,
      custom_instruction: config.custom_instruction ?? DEFAULT_CONFIG.custom_instruction,
    })
  }

  const value = useMemo(
    () => ({
      config,
      isAuthenticated: Boolean(config.token),
      updateConfig,
      login,
      logout,
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
