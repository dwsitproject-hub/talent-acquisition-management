const ROLE_MAP: Record<string, string> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CHRO: 'Management',
  DEPARTMENT_HEAD: 'Head of Division',
  HRBP: 'HRBP',
  TA_SITE: 'TA_SITE',
  TA_HO: 'TA_HO',
  HIRING_MANAGER: 'HIRING_MANAGER',
  INTERVIEWER: 'INTERVIEWER',
  CANDIDATE: 'CANDIDATE',
}

const DEFAULT_CANDIDATE_VISIBLE_ROLES = [
  'SUPER_ADMIN',
  'Management',
  'Head of Division',
  'HRBP',
  'TA_HO',
  'TA_SITE',
  'HIRING_MANAGER',
  'INTERVIEWER',
]

const DEFAULT_CANDIDATE_CREATE_ROLES = ['SUPER_ADMIN', 'HRBP', 'TA_HO', 'TA_SITE']
const DEFAULT_CANDIDATE_EDIT_ROLES = ['SUPER_ADMIN', 'HRBP', 'TA_HO', 'TA_SITE']

export function mapBackendRoleToDisplayName(role: string): string {
  if (!role) return role
  return ROLE_MAP[role] || role
}

export function resolveRoleNameFromUser(user: unknown): string {
  const backendRole =
    (user as { role?: { name?: string } | string })?.role &&
    typeof (user as { role?: { name?: string } | string }).role === 'object'
      ? ((user as { role?: { name?: string } }).role?.name as string)
      : ((user as { role?: string })?.role as string)
  return mapBackendRoleToDisplayName(backendRole || 'TA_HO')
}

/**
 * Candidate page permissions.
 * TA_SITE: list, view, create, and update master data. Position picker stays scoped
 * to their PT / Site / Area Detail. Delete remains blocked.
 */
export function resolveCandidatePermissions(
  roleName: string,
  menuAccess: Record<string, unknown> = {}
) {
  const cfg = (menuAccess['/candidates'] as {
    visibleRoles?: string[]
    permissions?: { create?: string[]; edit?: string[] }
  }) || {}

  const visibleRoles =
    cfg.visibleRoles && cfg.visibleRoles.length
      ? cfg.visibleRoles
      : DEFAULT_CANDIDATE_VISIBLE_ROLES

  const isTaSite = roleName === 'TA_SITE'
  const perms = cfg.permissions || {
    create: DEFAULT_CANDIDATE_CREATE_ROLES,
    edit: DEFAULT_CANDIDATE_EDIT_ROLES,
  }

  const canCreate =
    (perms.create || []).includes(roleName) || (perms.create || []).includes('*')
  const canEditFromMenu =
    (perms.edit || []).includes(roleName) || (perms.edit || []).includes('*')
  const canEdit = isTaSite || canEditFromMenu
  const canDelete = !isTaSite && canEditFromMenu
  const canViewDetails = true
  const canGenerateLink = ['SUPER_ADMIN', 'TA_HO', 'HRBP', 'TA_SITE'].includes(roleName)

  return {
    visibleRoles,
    canCreate,
    canEdit,
    canDelete,
    canViewDetails,
    canGenerateLink,
    isTaSiteListOnly: false,
  }
}
