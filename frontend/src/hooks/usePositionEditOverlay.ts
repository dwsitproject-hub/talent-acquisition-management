import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FPTKAPI, MenuAccessAPI } from '@/lib/api'
import { mapApiFptk } from '@/app/fptk/page'
import { buildFptkUpdatePayload, buildAppliedCandidatesOnlyPayload } from '@/utils/fptkUpdatePayload'
import {
  resolveFptkEditPermissions,
  resolveRoleNameFromUser,
} from '@/utils/fptkEditPermissions'
import type { FPTK } from '@/types'

function readMenuAccessFromStorage(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem('menuAccess') || 'null') || {}
  } catch {
    return {}
  }
}

export function usePositionEditOverlay(onAfterSave?: () => void) {
  const { user, isAuthenticated } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [jobPosting, setJobPosting] = useState<FPTK | null>(null)
  const [loading, setLoading] = useState(false)
  const [backLabel, setBackLabel] = useState('')
  const [menuAccess, setMenuAccess] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!isAuthenticated) {
      setMenuAccess({})
      return
    }

    setMenuAccess(readMenuAccessFromStorage())

    let cancelled = false
    MenuAccessAPI.get()
      .then((access) => {
        if (!cancelled) {
          setMenuAccess(access || {})
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMenuAccess(readMenuAccessFromStorage())
        }
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const roleName = resolveRoleNameFromUser(user)
  const { candidateStatusOnly, canManagePositionCandidates, canOpenPositionEdit } = useMemo(
    () => resolveFptkEditPermissions(roleName, menuAccess),
    [roleName, menuAccess]
  )

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
        if (candidateStatusOnly && canManagePositionCandidates) {
          const payload = buildAppliedCandidatesOnlyPayload(updatedData.appliedCandidates)
          await FPTKAPI.updateAppliedCandidates(jobPosting.id, payload)
        } else if (!candidateStatusOnly) {
          const payload = buildFptkUpdatePayload(jobPosting, updatedData)
          await FPTKAPI.update(jobPosting.id, payload)
        } else {
          return
        }
        close()
        onAfterSave?.()
      } catch (error: any) {
        console.error('usePositionEditOverlay: save', error)
        throw error
      }
    },
    [jobPosting, close, onAfterSave, candidateStatusOnly, canManagePositionCandidates]
  )

  return {
    isOpen,
    jobPosting,
    loading,
    backLabel,
    candidateStatusOnly,
    canManagePositionCandidates,
    canOpenPositionEdit,
    open,
    close,
    handleSave,
  }
}
