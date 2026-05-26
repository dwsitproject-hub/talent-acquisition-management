import { useCallback, useState } from 'react'
import { FPTKAPI } from '@/lib/api'
import { mapApiFptk } from '@/app/fptk/page'
import { buildFptkUpdatePayload } from '@/utils/fptkUpdatePayload'
import type { FPTK } from '@/types'

export function usePositionEditOverlay(onAfterSave?: () => void) {
  const [isOpen, setIsOpen] = useState(false)
  const [jobPosting, setJobPosting] = useState<FPTK | null>(null)
  const [loading, setLoading] = useState(false)
  const [backLabel, setBackLabel] = useState('')

  const close = useCallback(() => {
    setIsOpen(false)
    setJobPosting(null)
  }, [])

  const open = useCallback(async (fptkId: string, label = '') => {
    setBackLabel(label)
    setLoading(true)
    try {
      const fullFptkData = await FPTKAPI.getById(fptkId)
      setJobPosting(mapApiFptk(fullFptkData))
      setIsOpen(true)
    } catch (error) {
      console.error('usePositionEditOverlay: open', error)
      alert('Failed to load position. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSave = useCallback(
    async (updatedData: any) => {
      if (!jobPosting) return
      try {
        const payload = buildFptkUpdatePayload(jobPosting, updatedData)
        await FPTKAPI.update(jobPosting.id, payload)
        close()
        onAfterSave?.()
      } catch (error: any) {
        console.error('usePositionEditOverlay: save', error)
        alert(error.response?.data?.message || 'Failed to update position. Please try again.')
      }
    },
    [jobPosting, close, onAfterSave]
  )

  return {
    isOpen,
    jobPosting,
    loading,
    backLabel,
    open,
    close,
    handleSave,
  }
}
