'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  getStoredUser,
  setStoredUser,
  clearAuth,
  setAccessToken,
  type AuthUser,
} from './auth'
import { apiLogin, apiLogout, type LoginPayload } from './api'

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Restore from localStorage on mount
    const stored = getStoredUser()
    setUser(stored)
    setIsLoading(false)
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await apiLogin(payload)
    if (data.user.role !== 'CANDIDATE') {
      throw new Error('This portal is for candidates only. Please use the internal TA system.')
    }
    setAccessToken(data.accessToken)
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
      role: data.user.role,
      phoneNumber: data.user.phoneNumber,
    }
    setStoredUser(authUser)
    setUser(authUser)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // ignore errors – clear locally regardless
    }
    clearAuth()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
