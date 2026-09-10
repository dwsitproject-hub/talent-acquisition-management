'use client'

import { useEffect } from 'react'
import { getOidcCallbackUrl } from '@/lib/api'

/**
 * Hub often registers https://<tas>/auth/oidc/callback (no /api prefix).
 * Nginx may send that to Next.js; forward the code to the backend callback.
 */
export default function OidcCallbackBridgePage() {
  useEffect(() => {
    window.location.replace(getOidcCallbackUrl(window.location.search))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-600">Completing SSO sign-in…</p>
    </div>
  )
}
