import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUploadsProxyTarget(): string {
  const explicit = process.env.UPLOADS_PROXY_TARGET
  if (explicit) return explicit.replace(/\/+$/, '')

  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
  return api.replace(/\/api\/?$/i, '').replace(/\/+$/, '')
}

function isSafeSegment(segment: string): boolean {
  return Boolean(segment) && segment !== '.' && segment !== '..' && !segment.includes('\\')
}

function proxyHeaders(upstream: Headers): Headers {
  const headers = new Headers()
  for (const name of [
    'content-type',
    'content-length',
    'content-disposition',
    'cache-control',
    'last-modified',
    'etag',
    'x-tas-uploads',
  ]) {
    const value = upstream.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

async function proxyUpload(req: NextRequest, path: string[]): Promise<NextResponse> {
  if (!path.length || !path.every(isSafeSegment)) {
    return NextResponse.json({ success: false, message: 'Invalid upload path' }, { status: 400 })
  }

  const target = getUploadsProxyTarget()
  const url = `${target}/uploads/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`

  let upstream: Response
  const headers = new Headers()
  const authorization = req.headers.get('authorization')
  if (authorization) headers.set('authorization', authorization)
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      cache: 'no-store',
      redirect: 'manual',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'proxy failed'
    return NextResponse.json(
      { success: false, message: `Unable to reach document storage: ${message}` },
      { status: 502 }
    )
  }

  const headers = proxyHeaders(upstream.headers)
  if (req.method === 'HEAD') {
    return new NextResponse(null, { status: upstream.status, headers })
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params
  return proxyUpload(req, path)
}

export async function HEAD(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params
  return proxyUpload(req, path)
}
