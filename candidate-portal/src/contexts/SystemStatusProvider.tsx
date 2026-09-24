'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import UnderMaintenanceScreen from '@/components/UnderMaintenanceScreen'
import { checkBackendHealth } from '@/lib/backendHealth'

type SystemStatus = 'checking' | 'online' | 'offline'

type SystemStatusContextValue = {
  status: SystemStatus
  retryHealthCheck: () => Promise<void>
}

const SystemStatusContext = createContext<SystemStatusContextValue | undefined>(
  undefined
)

const ONLINE_POLL_MS = 60_000
const OFFLINE_POLL_MS = 15_000

export function SystemStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SystemStatus>('checking')
  const [isRetrying, setIsRetrying] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const runCheck = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let healthy = await checkBackendHealth(controller.signal)
    if (controller.signal.aborted) return
    if (!healthy) {
      healthy = await checkBackendHealth(controller.signal)
      if (controller.signal.aborted) return
    }

    setStatus(healthy ? 'online' : 'offline')
  }, [])

  const retryHealthCheck = useCallback(async () => {
    setIsRetrying(true)
    try {
      await runCheck()
    } finally {
      setIsRetrying(false)
    }
  }, [runCheck])

  useEffect(() => {
    void runCheck()
    return () => {
      abortRef.current?.abort()
    }
  }, [runCheck])

  useEffect(() => {
    const intervalMs = status === 'offline' ? OFFLINE_POLL_MS : ONLINE_POLL_MS
    if (status === 'checking') return

    const id = window.setInterval(() => {
      void runCheck()
    }, intervalMs)

    return () => window.clearInterval(id)
  }, [status, runCheck])

  const value: SystemStatusContextValue = { status, retryHealthCheck }

  return (
    <SystemStatusContext.Provider value={value}>
      {children}
      {status === 'offline' ? (
        <div className="fixed inset-0 z-[100]">
          <UnderMaintenanceScreen onRetry={() => void retryHealthCheck()} isRetrying={isRetrying} />
        </div>
      ) : null}
    </SystemStatusContext.Provider>
  )
}

export function useSystemStatus(): SystemStatusContextValue {
  const ctx = useContext(SystemStatusContext)
  if (!ctx) {
    throw new Error('useSystemStatus must be used within SystemStatusProvider')
  }
  return ctx
}
