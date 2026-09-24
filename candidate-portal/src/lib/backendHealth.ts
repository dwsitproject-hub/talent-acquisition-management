const HEALTH_TIMEOUT_MS = 8000

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

export function getHealthCheckUrls(): string[] {
  const candidates: string[] = []

  if (typeof window !== 'undefined') {
    candidates.push(`${window.location.origin}/api/health`)
  }

  const apiBase =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL?.trim() : undefined

  if (apiBase) {
    try {
      const normalized = stripTrailingSlashes(apiBase)
      if (normalized.endsWith('/api')) {
        const origin = normalized.slice(0, -4)
        candidates.push(`${origin}/api/health`)
        candidates.push(`${origin}/health`)
      } else {
        candidates.push(`${normalized}/health`)
      }
    } catch {
      // ignore malformed env
    }
  }

  if (typeof window !== 'undefined' && !apiBase) {
    const { protocol, hostname } = window.location
    candidates.push(`${protocol}//${hostname}:4000/health`)
  }

  if (typeof window === 'undefined' && !apiBase) {
    candidates.push('http://localhost:4000/health')
  }

  return Array.from(new Set(candidates))
}

export async function checkBackendHealth(signal?: AbortSignal): Promise<boolean> {
  const urls = getHealthCheckUrls()

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        signal: signal ?? AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      })

      if (!res.ok) continue

      const body = await res.json().catch(() => null)
      if (body && typeof body === 'object' && 'success' in body) {
        return (body as { success?: boolean }).success === true
      }
      return true
    } catch {
      // try next candidate
    }
  }

  return false
}

export const BACKEND_UNREACHABLE_EVENT = 'tas:backend-unreachable'

export function notifyBackendUnreachable(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BACKEND_UNREACHABLE_EVENT))
  }
}
