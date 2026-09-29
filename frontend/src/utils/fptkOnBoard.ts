/** Display/sort key for an open-position row. */
export function getFptkPositionSortName(fptk: {
  title?: string | null
  position?: string | null
  positionTitle?: string | null
}): string {
  return (fptk.title || fptk.position || fptk.positionTitle || '').trim()
}

/**
 * Position is treated as on board when hired (Close) or has a candidate in On Boarding.
 */
export function isFptkOnBoard(fptk: {
  currentStatus?: string | null
  appliedCandidates?: Array<{ status?: string | null; backendStatus?: string | null }> | null
}): boolean {
  const status = (fptk.currentStatus || '').trim().toLowerCase()
  if (status === 'close') return true

  for (const candidate of fptk.appliedCandidates || []) {
    const raw = (candidate.backendStatus || candidate.status || '').toString().trim()
    if (!raw) continue
    const normalized = raw.toUpperCase().replace(/[\s-]+/g, '_')
    if (normalized === 'ONBOARDING') return true
    if (raw.toLowerCase() === 'on boarding') return true
  }

  return false
}

export function compareFptkPositionNameAsc(
  a: { title?: string | null; position?: string | null; positionTitle?: string | null },
  b: { title?: string | null; position?: string | null; positionTitle?: string | null }
): number {
  return getFptkPositionSortName(a).localeCompare(getFptkPositionSortName(b), undefined, {
    sensitivity: 'base',
  })
}

/** Open / active recruiting rows first, then on-board; each block A–Z by position name. */
export function sortFptksOpenFirstOnBoardLast<
  T extends {
    currentStatus?: string | null
    appliedCandidates?: Array<{ status?: string | null; backendStatus?: string | null }> | null
    title?: string | null
    position?: string | null
    positionTitle?: string | null
  },
>(items: T[]): T[] {
  const open: T[] = []
  const onBoard: T[] = []
  items.forEach((item) => {
    if (isFptkOnBoard(item)) onBoard.push(item)
    else open.push(item)
  })
  open.sort(compareFptkPositionNameAsc)
  onBoard.sort(compareFptkPositionNameAsc)
  return [...open, ...onBoard]
}
