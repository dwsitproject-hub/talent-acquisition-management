'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, AuthResponse } from '@/types'
import api from '@/lib/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we're in the browser environment
        if (typeof window === 'undefined') {
          setIsLoading(false)
          return
        }

        const token = localStorage.getItem('authToken')
        if (token) {
          try {
            // Verify token and get user info
            const response = await api.get('/auth/me')
            setUser(response.data.data.user)
          } catch (error) {
            // Token is invalid, clear it
            try {
              localStorage.removeItem('authToken')
              localStorage.removeItem('refreshToken')
            } catch (e) {
              // Ignore localStorage errors
              console.warn('Could not clear auth tokens:', e)
            }
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      })

      const { user, accessToken, refreshToken } = response.data.data

      // Only set localStorage if in browser
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('authToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
        } catch (e) {
          console.warn('Could not save auth tokens to localStorage:', e)
        }
      }
      setUser(user)
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed')
    }
  }

  const logout = () => {
    try {
      // Clear state first to prevent any useEffect hooks from running
      setUser(null)
      
      // Then clear localStorage (only if in browser)
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('authToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('menuAccess') // Also clear menuAccess from localStorage if exists
          
          // Clear any other auth-related data
          try {
            localStorage.removeItem('candidates')
            localStorage.removeItem('jobPostings')
          } catch (e) {
            // Ignore errors when clearing optional items
          }
        } catch (e) {
          console.warn('Could not clear localStorage during logout:', e)
        }
      }
    } catch (error) {
      console.error('Error during logout:', error)
      // Still clear user even if localStorage fails
      setUser(null)
    }
  }

  const refreshToken = async () => {
    try {
      // Only access localStorage if in browser
      if (typeof window === 'undefined') {
        throw new Error('Cannot refresh token on server')
      }

      const refreshTokenValue = localStorage.getItem('refreshToken')
      if (!refreshTokenValue) throw new Error('No refresh token')

      const response = await api.post<AuthResponse>('/auth/refresh', {
        refreshToken: refreshTokenValue,
      })

      const { accessToken, refreshToken: newRefreshToken } = response.data.data
      
      try {
        localStorage.setItem('authToken', accessToken)
        localStorage.setItem('refreshToken', newRefreshToken)
      } catch (e) {
        console.warn('Could not save refresh tokens to localStorage:', e)
      }
    } catch (error) {
      logout()
      throw error
    }
  }

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
