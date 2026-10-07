/**
 * Backend origin (no /api suffix) for server-side proxies (uploads, OIDC).
 * When NEXT_PUBLIC_API_URL points at this Next.js host (e.g. Hub callback on :4041/api),
 * set UPLOADS_PROXY_TARGET to the real API origin or proxies will loop to themselves.
 */
export function getBackendOrigin(): string {
  const explicit = process.env.UPLOADS_PROXY_TARGET
  if (explicit) return explicit.replace(/\/+$/, '')

  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
  return api.replace(/\/api\/?$/i, '').replace(/\/+$/, '')
}
