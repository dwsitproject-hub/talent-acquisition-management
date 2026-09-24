'use client'

import { ArrowPathIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'

type UnderMaintenanceScreenProps = {
  productName?: string
  onRetry?: () => void
  isRetrying?: boolean
}

export default function UnderMaintenanceScreen({
  productName = 'KPN Talent Acquisition System',
  onRetry,
  isRetrying = false,
}: UnderMaintenanceScreenProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--color-bg-lighter, #FAFAFA)' }}
    >
      <div className="w-full max-w-lg text-center">
        <div
          className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm"
          style={{
            background: 'var(--color-bg-white, #fff)',
            border: '1px solid var(--color-border-light, #E0E0E0)',
          }}
        >
          <WrenchScrewdriverIcon
            className="h-8 w-8"
            style={{ color: 'var(--color-brand-red-primary, #C43A31)' }}
            aria-hidden
          />
        </div>

        <p
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-brand-red-primary, #C43A31)' }}
        >
          Under maintenance
        </p>

        <h1
          className="mt-3 font-serif text-3xl font-bold sm:text-4xl"
          style={{
            color: 'var(--color-text-charcoal, #2B2B2B)',
            fontFamily: 'var(--font-family-heading, Merriweather, Georgia, serif)',
          }}
        >
          We&apos;ll be back shortly
        </h1>

        <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--color-text-steel, #6B6B6B)' }}>
          {productName} is temporarily unavailable while we restore our services. Your data is safe.
          Please try again in a few minutes.
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-8 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--color-brand-red-primary, #C43A31)' }}
          >
            <ArrowPathIcon className={`h-5 w-5 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden />
            {isRetrying ? 'Checking…' : 'Try again'}
          </button>
        )}

        <p className="mt-10 text-xs" style={{ color: 'var(--color-text-steel, #6B6B6B)' }}>
          If this persists, contact your HR or IT support team.
        </p>
      </div>
    </div>
  )
}
