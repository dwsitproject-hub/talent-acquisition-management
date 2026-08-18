'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

function SsoHandoffContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { completeSsoLogin } = useAuth()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const handoff = searchParams.get('handoff')
      if (!handoff) {
        if (!cancelled) {
          setError('Missing SSO handoff token')
          setIsLoading(false)
        }
        return
      }

      try {
        await completeSsoLogin(handoff)
        if (!cancelled) {
          router.replace('/')
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'SSO login failed')
          setIsLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {isLoading ? 'Completing SSO sign-in…' : 'SSO sign-in failed'}
        </h2>
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-left">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}
        {!isLoading && (
          <Link
            href="/login"
            className="inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Back to login
          </Link>
        )}
      </div>
    </div>
  )
}

export default function SsoHandoffPage() {
  return (
    <Suspense>
      <SsoHandoffContent />
    </Suspense>
  )
}
