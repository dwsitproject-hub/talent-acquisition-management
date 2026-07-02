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

const DEFAULT_FPTK_VISIBLE_ROLES = [
  'SUPER_ADMIN',
  'Management',
  'Head of Division',
  'HRBP',
  'TA_HO',
  'TA_SITE',
  'HIRING_MANAGER',
]

const DEFAULT_FPTK_EDIT_ROLES = ['SUPER_ADMIN', 'TA_HO', 'HIRING_MANAGER']

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

export function resolveFptkEditPermissions(
  roleName: string,
  menuAccess: Record<string, unknown> = {}
) {
  const cfg = (menuAccess['/fptk'] as {
    visibleRoles?: string[]
    permissions?: { edit?: string[] }
  }) || {}

  const visibleRoles =
    cfg.visibleRoles && cfg.visibleRoles.length ? cfg.visibleRoles : DEFAULT_FPTK_VISIBLE_ROLES

  const perms = cfg.permissions || { edit: DEFAULT_FPTK_EDIT_ROLES }
  const canEdit =
    (perms.edit || []).includes(roleName) || (perms.edit || []).includes('*')
  const candidateStatusOnly = roleName === 'TA_SITE' && !canEdit
  const canOpenPositionEdit = canEdit || candidateStatusOnly

  return {
    visibleRoles,
    canEdit,
    candidateStatusOnly,
    canOpenPositionEdit,
  }
}
