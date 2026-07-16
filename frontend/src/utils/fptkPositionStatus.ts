/**
 * Open vs closed classification for FPTK rows — canonical single source of
 * truth for the frontend. Keep in sync with `CURRENT_STATUS_OPTIONS` on the
 * Position page (`/fptk`) and with backend `src/utils/positionSla.js`.
 *
 * Closed = terminal / exited pipeline: Close, Cancel(led), Internal Movement.
 * Open = all other currentStatus values (Open, Pending FKTK, Re-Open, Hold, empty, etc.)
 * so Open + Closed always equals Total.
 */

const CLOSED_CURRENT_STATUSES = ['close', 'cancel', 'cancelled', 'internal movement']

export function normalizeUiCurrentStatus(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

/** Same semantics as Position page chips: Close, Cancel(led), Internal Movement */
export function isFptkClosedByCurrentStatus(currentStatus?: string | null): boolean {
  return CLOSED_CURRENT_STATUSES.includes(normalizeUiCurrentStatus(currentStatus))
}

const CANCEL_IM_CURRENT_STATUSES = ['cancel', 'cancelled', 'internal movement']

/** The Closed statuses that are NOT Hired (Close): Cancel(led) | Internal Movement. */
export function isFptkCancelOrInternalMovement(currentStatus?: string | null): boolean {
  return CANCEL_IM_CURRENT_STATUSES.includes(normalizeUiCurrentStatus(currentStatus))
}

export function isFptkOpenByCurrentStatus(currentStatus?: string | null): boolean {
  return !isFptkClosedByCurrentStatus(currentStatus)
}

export function displayFptkCurrentStatus(currentStatus?: string | null): string {
  const raw = (currentStatus || '').trim()
  return raw || 'Pending FKTK'
}
