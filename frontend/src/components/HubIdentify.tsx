'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

declare global {
  interface Window {
    DwsHub?: any
  }
}

/**
 * Tells the DWS Hub SDK who is signed in (Hub `sub` + email). The SDK loads with
 * `defer`, so the call is queued on `window.DwsHub` when it is not ready yet.
 */
export default function HubIdentify() {
  const { user } = useAuth()
  const hubUserId = user?.oidcSub
  const email = user?.email

  useEffect(() => {
    if (!hubUserId && !email) return
    const identity = { id: hubUserId ?? undefined, email: email ?? undefined }
    const hub = (window.DwsHub = window.DwsHub || [])
    if (typeof hub.identify === 'function') hub.identify(identity)
    else hub.push(['identify', identity])
  }, [hubUserId, email])

  return null
}
