'use client'

import { useEffect } from 'react'
import { getOidcLoginUrl } from '@/lib/api'

/** If a bookmark or Hub hits the UI origin, start the real backend OIDC login. */
export default function OidcLoginBridgePage() {
  useEffect(() => {
    window.location.replace(getOidcLoginUrl())
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-600">Redirecting to DWS Hub…</p>
    </div>
  )
}
