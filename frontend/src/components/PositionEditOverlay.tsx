'use client'

import EditJobPostingModal from '@/components/EditJobPostingModal'
import type { FPTK } from '@/types'

interface PositionEditOverlayProps {
  isOpen: boolean
  jobPosting: FPTK | null
  loading: boolean
  onClose: () => void
  onSave: (updatedData: any) => void | Promise<void>
  headerBackLabel: string
  overlayZIndex?: number
  candidateStatusOnly?: boolean
}

export default function PositionEditOverlay({
  isOpen,
  jobPosting,
  loading,
  onClose,
  onSave,
  headerBackLabel,
  overlayZIndex = 10050,
  candidateStatusOnly = false,
}: PositionEditOverlayProps) {
  return (
    <>
      {loading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: overlayZIndex - 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '16px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#374151',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            }}
          >
            Opening position…
          </div>
        </div>
      )}

      <EditJobPostingModal
        isOpen={isOpen && !!jobPosting}
        onClose={onClose}
        jobPosting={jobPosting}
        onSave={onSave}
        overlayZIndex={overlayZIndex}
        headerBackLabel={headerBackLabel}
        candidateStatusOnly={candidateStatusOnly}
      />
    </>
  )
}
