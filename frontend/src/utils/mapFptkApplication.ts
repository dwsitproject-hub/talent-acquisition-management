import { ApplicationsAPI } from '@/lib/api'
import { mapApplicationStatusToUi } from '@/utils/applicationStatusUi'

function parseJsonField(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>
  return null
}

/** Map a backend Application row (with candidate + interviews) to applied-candidate UI shape. */
export function mapApplicationToAppliedCandidate(application: any) {
  const candidate = application?.candidate || {}
  const user = candidate.user || {}
  const formDataDiri = parseJsonField(candidate.formDataDiri)
  const languagesData = parseJsonField(candidate.languages)

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    (formDataDiri?.fullName as string) ||
    candidate.fullName ||
    candidate.name ||
    `Candidate ${String(candidate.id || '').slice(0, 6)}`

  const email = user.email || candidate.email || (formDataDiri?.email as string) || ''
  const skills = Array.isArray(candidate.skills)
    ? candidate.skills
    : Array.isArray(languagesData?.skills)
      ? (languagesData.skills as string[])
      : []

  const interviews = Array.isArray(application.interviews)
    ? application.interviews.map((interview: any) => {
        let interviewerName = ''
        if (interview.interviewer) {
          interviewerName =
            `${interview.interviewer.firstName || ''} ${interview.interviewer.lastName || ''}`.trim() ||
            interview.interviewer.email ||
            ''
        } else if (interview.interviewerName) {
          interviewerName = interview.interviewerName
        }
        return {
          interviewer: interviewerName,
          date: interview.scheduledAt
            ? new Date(interview.scheduledAt).toISOString().split('T')[0]
            : '',
          time: interview.scheduledAt
            ? new Date(interview.scheduledAt).toTimeString().split(' ')[0].slice(0, 5)
            : '',
          results: interview.notes || '',
        }
      })
    : []

  return {
    applicationId: application.id,
    id: candidate.id,
    candidateId: candidate.id,
    fullName,
    name: fullName,
    email,
    phone: user.phoneNumber || '',
    status: mapApplicationStatusToUi(application.status),
    backendStatus: application.status,
    appliedDate: application.appliedAt,
    rejectedDate: application.rejectedAt,
    withdrawDate: application.withdrawnAt,
    joinDate: application.joinDate
      ? new Date(application.joinDate).toISOString().split('T')[0]
      : null,
    source: application.source,
    skills,
    experience:
      typeof languagesData?.yearsOfExperience === 'number' ? languagesData.yearsOfExperience : 0,
    yearsOfExperience:
      typeof languagesData?.yearsOfExperience === 'number' ? languagesData.yearsOfExperience : 0,
    division: user.division || candidate.division || null,
    interviews,
  }
}

/** Load all applications linked to a specific FPTK id (paginated API). */
export async function fetchApplicationsForFptk(fptkId: string): Promise<any[]> {
  const merged: any[] = []
  let page = 1
  const limit = 100
  let totalPages = 1

  do {
    const res = await ApplicationsAPI.getAll({ fptkId }, { page, limit })
    const batch: any[] = (res as any).data || []
    merged.push(...batch)
    totalPages = (res as any).pagination?.totalPages ?? 1
    page += 1
  } while (page <= totalPages)

  return merged.map(mapApplicationToAppliedCandidate)
}
