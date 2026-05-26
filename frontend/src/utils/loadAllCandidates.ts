import { CandidatesAPI } from '@/lib/api'

/** Loads all candidates via paginated API (max 100 per page). */
export async function loadAllCandidatesPaginated(maxPages = 50): Promise<any[]> {
  const all: any[] = []
  let page = 1
  const limit = 100

  while (page <= maxPages) {
    const response = await CandidatesAPI.getAll({}, { page, limit })
    const batch = response.data || []
    all.push(...batch)

    const totalPages = response.pagination?.totalPages
    if (typeof totalPages === 'number') {
      if (page >= totalPages) break
    } else if (batch.length < limit) {
      break
    }
    page += 1
  }

  return all
}
