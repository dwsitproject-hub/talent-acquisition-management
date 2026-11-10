/** Parse API errors when syncing applied candidates to a position. */

export function isCandidateLockSaveError(error: unknown): boolean {
  const err = error as { response?: { status?: number; data?: { code?: string; message?: string } } }
  const status = err.response?.status
  const data = err.response?.data
  const message = String(data?.message || '').toLowerCase()

  return (
    status === 409 &&
    (data?.code === 'CANDIDATE_LOCKED_FOR_OTHER_POSITION' ||
      data?.code === 'POSITION_ONBOARDING_LIMIT_REACHED' ||
      message.includes('cannot be applied') ||
      message.includes('onboarding') ||
      message.includes('hired'))
  )
}

export function getCandidateSaveErrorMessage(error: unknown): string {
  const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string }
  if (err.response?.status === 403) {
    const detail = err.response?.data?.message
    return `You do not have permission to perform this action (403${detail ? `: ${detail}` : ''}). Please contact your administrator.`
  }
  return (
    err.response?.data?.message ||
    err.message ||
    'Failed to save candidates. Please try again.'
  )
}
