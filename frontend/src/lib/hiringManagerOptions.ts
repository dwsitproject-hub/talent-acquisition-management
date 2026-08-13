import { AdminUsersAPI } from '@/lib/api'

export type HiringManagerOption = {
  firstName: string
  lastName: string
}

/** Position HM dropdown includes Hiring Managers and Heads of Division in the same division. */
export const HIRING_MANAGER_OPTION_ROLES = 'HIRING_MANAGER,Head of Division'

function optionName(user: HiringManagerOption): string {
  return `${user.firstName} ${user.lastName}`.trim()
}

export function mapUsersToHiringManagerOptions(users: any[] | null | undefined): HiringManagerOption[] {
  const seen = new Set<string>()
  return (users || [])
    .filter((user: any) => user?.isActive !== false)
    .map((user: any) => ({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
    }))
    .filter((user) => {
      const name = optionName(user).toLowerCase()
      if (!name || seen.has(name)) return false
      seen.add(name)
      return true
    })
    .sort((a, b) => optionName(a).toLowerCase().localeCompare(optionName(b).toLowerCase()))
}

export async function loadHiringManagerOptions(division: string): Promise<HiringManagerOption[]> {
  const users = await AdminUsersAPI.list('', HIRING_MANAGER_OPTION_ROLES, undefined, division)
  return mapUsersToHiringManagerOptions(users)
}
