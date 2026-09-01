import { AdminUsersAPI } from '@/lib/api'

export type InterviewerOption = {
  id: string
  firstName: string
  lastName: string
  email: string
}

/** Interviewer autocomplete uses User Management roles: HM, HoD, and Management. */
export const INTERVIEWER_OPTION_ROLES = 'HIRING_MANAGER,Head of Division,Management'

function optionKey(user: InterviewerOption): string {
  return `${user.firstName} ${user.lastName}`.trim().toLowerCase() || (user.email || '').toLowerCase()
}

function optionLabel(user: InterviewerOption): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.email
}

export function mapUsersToInterviewerOptions(users: any[] | null | undefined): InterviewerOption[] {
  const seen = new Set<string>()
  return (users || [])
    .filter((user: any) => user?.isActive !== false)
    .map((user: any) => ({
      id: user.id || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
    }))
    .filter((user) => {
      const key = optionKey(user)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => optionLabel(a).toLowerCase().localeCompare(optionLabel(b).toLowerCase()))
}

export async function loadInterviewerOptions(): Promise<InterviewerOption[]> {
  const users = await AdminUsersAPI.list('', INTERVIEWER_OPTION_ROLES)
  return mapUsersToInterviewerOptions(users)
}
