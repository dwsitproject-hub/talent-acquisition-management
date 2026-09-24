'use client'

type UnderMaintenanceScreenProps = {
  productName?: string
  onRetry?: () => void
  isRetrying?: boolean
}

export default function UnderMaintenanceScreen({
  productName = 'KPN Careers Portal',
  onRetry,
  isRetrying = false,
}: UnderMaintenanceScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
          <svg
            className="h-8 w-8 text-red-700"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.198 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.776 3.777a3 3 0 0 1-3.639 3.639l-3.776 3.776a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 6.615 1.745-1.437"
            />
          </svg>
        </div>

        <p className="text-sm font-semibold uppercase tracking-wide text-red-700">Under maintenance</p>

        <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">We&apos;ll be back shortly</h1>

        <p className="mt-4 text-base leading-relaxed text-gray-600">
          {productName} is temporarily unavailable while we restore our services. Please try again in
          a few minutes.
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isRetrying ? 'Checking…' : 'Try again'}
          </button>
        )}

        <p className="mt-10 text-xs text-gray-500">
          If this persists, contact KPN HR or your recruiting contact.
        </p>
      </div>
    </div>
  )
}
