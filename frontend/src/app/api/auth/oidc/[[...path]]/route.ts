import { NextRequest, NextResponse } from 'next/server'
import { getBackendOrigin } from '@/lib/backendOrigin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildBackendOidcUrl(req: NextRequest, path: string[] | undefined): string {
  const suffix = path?.length ? `/${path.map(encodeURIComponent).join('/')}` : ''
  const origin = getBackendOrigin()
  return `${origin}/api/auth/oidc${suffix}${req.nextUrl.search}`
}

function forwardResponseHeaders(upstream: Response): Headers {
  const headers = new Headers()
  upstream.headers.forEach((value, name) => {
    if (name.toLowerCase() === 'set-cookie') return
    headers.append(name, value)
  })
  const setCookies =
    typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : []
  for (const cookie of setCookies) {
    headers.append('set-cookie', cookie)
  }
  return headers
}

async function proxyOidc(req: NextRequest, path: string[] | undefined): Promise<NextResponse> {
  const url = buildBackendOidcUrl(req, path)
  const headers = new Headers()
  const cookie = req.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)

  let body: ArrayBuffer | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer()
    const contentType = req.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
  }

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'proxy failed'
    return NextResponse.json(
      { success: false, message: `Unable to reach auth service: ${message}` },
      { status: 502 }
    )
  }

  if (req.method === 'HEAD') {
    return new NextResponse(null, {
      status: upstream.status,
      headers: forwardResponseHeaders(upstream),
    })
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: forwardResponseHeaders(upstream),
  })
}

type RouteContext = { params: Promise<{ path?: string[] }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyOidc(req, path)
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyOidc(req, path)
}
