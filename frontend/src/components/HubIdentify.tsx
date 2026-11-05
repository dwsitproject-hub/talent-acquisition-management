'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

declare global {
  interface Window {
    DwsHub?: any
  }
}

/**
 * Tells the DWS Hub SDK who is signed in (Hub `sub` + email).
 *
 * Always uses the `push` form from the SDK integration guide: it is queued and replayed
 * in order if the SDK (loaded with `defer`) is not ready yet, and runs at once otherwise.
 * Never call `DwsHub.identify(...)` / `DwsHub?.identify(...)` directly — that is silently
 * skipped before the SDK loads, leaving the user anonymous in Sentinel.
 * `identify` is idempotent in the SDK, so running on every restored session is fine.
 * Sign-out is handled by `reset` in AuthContext.logout.
 */
export default function HubIdentify() {
  const { user } = useAuth()
  const hubUserId = user?.oidcSub
  const email = user?.email

  useEffect(() => {
    if (!hubUserId && !email) return
    const identity = { id: hubUserId ?? undefined, email: email ?? undefined }
    ;(window.DwsHub = window.DwsHub || []).push(['identify', identity])
  }, [hubUserId, email])

  return null
}
