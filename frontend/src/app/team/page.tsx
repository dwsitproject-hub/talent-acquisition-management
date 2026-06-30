'use client'

import { useEffect, useMemo, useState } from 'react'
import { useModalEscape } from '@/hooks/useModalEscape'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import { PlusIcon, MagnifyingGlassIcon, UserGroupIcon, EnvelopeIcon, PhoneIcon, BriefcaseIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { AdminUsersAPI, MasterDivisionAPI, MasterOfficeLocationAPI, MenuAccessAPI } from '@/lib/api'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'

const TA_SITE_AREA = 'Site'

const USER_AREA_FILTERS = ['ALL', 'Site', 'HO'] as const
type UserAreaFilterType = typeof USER_AREA_FILTERS[number]

interface TeamMember {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: string
  division: string
  sectionName?: string
  isActive: boolean
  lastLoginAt?: string
  avatar?: string
  pt?: string
  area?: string
  areaDetail?: string
}

export default function TeamPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState<UserAreaFilterType>('ALL')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [defaultPassword, setDefaultPassword] = useState('DefaultPassword123!')
  const [showDefaultPassword, setShowDefaultPassword] = useState(false)
  const [uploadingUsers, setUploadingUsers] = useState(false)
  const [uploadResult, setUploadResult] = useState<any | null>(null)
const [newMember, setNewMember] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'TA_HO',
    division: '',
    sectionName: '',
    hodDivisions: [] as string[],
    hodSections: [] as string[],
    hrbpPts: [] as string[],
    hrbpAreas: [] as string[],
    hrbpAreaDetails: [] as string[],
    pt: '',
    area: '',
    areaDetail: ''
  })
  const [editMember, setEditMember] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    division: '',
    sectionName: '',
    hodDivisions: [] as string[],
    hodSections: [] as string[],
    hrbpPts: [] as string[],
    hrbpAreas: [] as string[],
    hrbpAreaDetails: [] as string[],
    pt: '',
    area: '',
    areaDetail: '',
    resetPassword: false
  })
  const [divisions, setDivisions] = useState<{ id: string, divisionName: string, sectionName: string }[]>([])
  const [officeLocations, setOfficeLocations] = useState<any[]>([])
  // Menu Access Management (SUPER_ADMIN only)
const ROLE_OPTIONS = ['SUPER_ADMIN','Management','Head of Division','HRBP','TA_HO','TA_SITE','HIRING_MANAGER'] as const
const allRoles = [...ROLE_OPTIONS]

type MenuAccessConfig = {
  visibleRoles: string[]
  permissions: {
    create: string[]
    edit: string[]
  }
}

const routes: Array<{
  path: string
  label: string
  defaults: MenuAccessConfig
}> = [
  {
    path: '/',
    label: 'Dashboard',
    defaults: {
      visibleRoles: allRoles,
      permissions: { create: [], edit: [] },
    },
  },
  {
    path: '/fptk',
    label: 'Open Position',
    defaults: {
      visibleRoles: allRoles,
      permissions: { create: ['SUPER_ADMIN','TA_HO','HIRING_MANAGER'], edit: ['SUPER_ADMIN','TA_HO','HIRING_MANAGER'] },
    },
  },
  {
    path: '/candidates',
    label: 'Candidate → Candidates',
    defaults: {
      visibleRoles: [
        'SUPER_ADMIN',
        'Management',
        'Head of Division',
        'HRBP',
        'TA_HO',
        'TA_SITE',
        'HIRING_MANAGER',
        'INTERVIEWER',
      ],
      permissions: {
        create: ['SUPER_ADMIN', 'HRBP', 'TA_HO', 'TA_SITE'],
        edit: ['SUPER_ADMIN', 'HRBP', 'TA_HO', 'TA_SITE'],
      },
    },
  },
  {
    path: '/candidates/kiv',
    label: 'Candidate → KIV',
    defaults: {
      visibleRoles: [
        'SUPER_ADMIN',
        'Management',
        'Head of Division',
        'HRBP',
        'TA_HO',
        'TA_SITE',
        'HIRING_MANAGER',
        'INTERVIEWER',
      ],
      permissions: {
        create: [],
        edit: ['SUPER_ADMIN', 'HRBP', 'TA_HO', 'TA_SITE'],
      },
    },
  },
  {
    path: '/summary-by-position',
    label: 'Summary by Position',
    defaults: {
      visibleRoles: allRoles,
      permissions: { create: [], edit: [] },
    },
  },
  {
    path: '/reports',
    label: 'Reports',
    defaults: {
      visibleRoles: allRoles,
      permissions: { create: [], edit: [] },
    },
  },
  {
    path: '/team',
    label: 'User Management',
    defaults: {
      visibleRoles: ['SUPER_ADMIN','TA_HO'],
      permissions: { create: ['SUPER_ADMIN','TA_HO'], edit: ['SUPER_ADMIN','TA_HO'] },
    },
  },
  {
    path: '/masters/division',
    label: 'Master Division',
    defaults: {
      visibleRoles: ['SUPER_ADMIN','Management','Head of Division','HRBP','TA_HO','TA_SITE'],
      permissions: { create: ['SUPER_ADMIN','TA_HO'], edit: ['SUPER_ADMIN','TA_HO'] },
    },
  },
  {
    path: '/masters/office-location',
    label: 'Master Office Location',
    defaults: {
      visibleRoles: ['SUPER_ADMIN','Management','Head of Division','HRBP','TA_HO','TA_SITE'],
      permissions: { create: ['SUPER_ADMIN','TA_HO'], edit: ['SUPER_ADMIN','TA_HO'] },
    },
  },
  {
    path: '/settings',
    label: 'Settings',
    defaults: {
      visibleRoles: allRoles,
      permissions: { create: [], edit: [] },
    },
  },
]

const defaultMenuAccessState: Record<string, MenuAccessConfig> = routes.reduce(
  (acc, route) => ({ ...acc, [route.path]: route.defaults }),
  {}
)

const hydrateMenuAccess = (stored: Record<string, MenuAccessConfig> | null | undefined) => {
  const merged: Record<string, MenuAccessConfig> = { ...defaultMenuAccessState }
  if (stored && typeof stored === 'object') {
    Object.keys(stored).forEach((path) => {
      const existing = merged[path] || { visibleRoles: [], permissions: { create: [], edit: [] } }
      const storedConfig = stored[path] || {}
      merged[path] = {
        visibleRoles: Array.isArray(storedConfig.visibleRoles) && storedConfig.visibleRoles.length > 0
          ? storedConfig.visibleRoles
          : existing.visibleRoles,
        permissions: {
          create: Array.isArray(storedConfig.permissions?.create) ? storedConfig.permissions.create : existing.permissions.create,
          edit: Array.isArray(storedConfig.permissions?.edit) ? storedConfig.permissions.edit : existing.permissions.edit,
        },
      }
    })
  }
  return merged
}

const [menuAccessState, setMenuAccessState] = useState<Record<string, MenuAccessConfig>>(defaultMenuAccessState)
const [menuAccessLoading, setMenuAccessLoading] = useState(true)

useModalEscape(isAddOpen, () => setIsAddOpen(false))
useModalEscape(isEditOpen && !!editingMember, () => {
  setIsEditOpen(false)
  setEditingMember(null)
})

// Load menu access from API
useEffect(() => {
  const loadMenuAccess = async () => {
    try {
      const access = await MenuAccessAPI.get()
      if (access && Object.keys(access).length > 0) {
        setMenuAccessState(hydrateMenuAccess(access))
      } else {
        setMenuAccessState(defaultMenuAccessState)
      }
    } catch (error) {
      console.error('Error loading menu access:', error)
      setMenuAccessState(defaultMenuAccessState)
    } finally {
      setMenuAccessLoading(false)
    }
  }

  if (isAuthenticated && !isLoading) {
    loadMenuAccess()
  }
}, [isAuthenticated, isLoading])

const handleSaveMenuAccess = async () => {
  try {
    await MenuAccessAPI.update(menuAccessState)
    alert('Menu access rules saved successfully.')
  } catch (error: any) {
    console.error('Error saving menu access:', error)
    alert(error.response?.data?.message || 'Failed to save menu access rules. Please try again.')
  }
}

  const ptOptions = useMemo(() => {
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (loc?.pt) {
        set.add(loc.pt)
      }
    })
    return Array.from(set)
  }, [officeLocations])

  const newMemberAreaOptions = useMemo(() => {
    if (!newMember.pt) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (loc?.pt === newMember.pt && loc?.area) {
        set.add(loc.area)
      }
    })
    return Array.from(set)
  }, [newMember.pt, officeLocations])

  const newMemberAreaDetailOptions = useMemo(() => {
    if (!newMember.pt || !newMember.area) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (loc?.pt === newMember.pt && loc?.area === newMember.area && loc?.areaDetail) {
        set.add(loc.areaDetail)
      }
    })
    return Array.from(set)
  }, [newMember.pt, newMember.area, officeLocations])

  const editMemberAreaOptions = useMemo(() => {
    if (!editMember.pt) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (loc?.pt === editMember.pt && loc?.area) {
        set.add(loc.area)
      }
    })
    return Array.from(set)
  }, [editMember.pt, officeLocations])

  const editMemberAreaDetailOptions = useMemo(() => {
    if (!editMember.pt || !editMember.area) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (loc?.pt === editMember.pt && loc?.area === editMember.area && loc?.areaDetail) {
        set.add(loc.areaDetail)
      }
    })
    return Array.from(set)
  }, [editMember.pt, editMember.area, officeLocations])

  const uniqueDivisionOptions = useMemo(() => [...new Set(divisions.map(d => d.divisionName))], [divisions])

  const newHodSectionOptions = useMemo(() => {
    if (newMember.hodDivisions.length === 0) return []
    const set = new Set<string>()
    divisions.forEach((d) => {
      if (newMember.hodDivisions.includes(d.divisionName) && d.sectionName) {
        set.add(d.sectionName)
      }
    })
    return Array.from(set)
  }, [newMember.hodDivisions, divisions])

  const editHodSectionOptions = useMemo(() => {
    if (editMember.hodDivisions.length === 0) return []
    const set = new Set<string>()
    divisions.forEach((d) => {
      if (editMember.hodDivisions.includes(d.divisionName) && d.sectionName) {
        set.add(d.sectionName)
      }
    })
    return Array.from(set)
  }, [editMember.hodDivisions, divisions])

  const newScopedAreaOptions = useMemo(() => {
    if (newMember.hrbpPts.length === 0) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (newMember.hrbpPts.includes(loc?.pt) && loc?.area) {
        set.add(loc.area)
      }
    })
    return Array.from(set)
  }, [newMember.hrbpPts, officeLocations])

  const newScopedAreaDetailOptions = useMemo(() => {
    if (newMember.hrbpPts.length === 0 || newMember.hrbpAreas.length === 0) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (
        newMember.hrbpPts.includes(loc?.pt) &&
        newMember.hrbpAreas.includes(loc?.area) &&
        loc?.areaDetail
      ) {
        set.add(loc.areaDetail)
      }
    })
    return Array.from(set)
  }, [newMember.hrbpPts, newMember.hrbpAreas, officeLocations])

  const editScopedAreaOptions = useMemo(() => {
    if (editMember.hrbpPts.length === 0) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (editMember.hrbpPts.includes(loc?.pt) && loc?.area) {
        set.add(loc.area)
      }
    })
    return Array.from(set)
  }, [editMember.hrbpPts, officeLocations])

  const editScopedAreaDetailOptions = useMemo(() => {
    if (editMember.hrbpPts.length === 0 || editMember.hrbpAreas.length === 0) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (
        editMember.hrbpPts.includes(loc?.pt) &&
        editMember.hrbpAreas.includes(loc?.area) &&
        loc?.areaDetail
      ) {
        set.add(loc.areaDetail)
      }
    })
    return Array.from(set)
  }, [editMember.hrbpPts, editMember.hrbpAreas, officeLocations])

  const newTaSiteAreaDetailOptions = useMemo(() => {
    if (newMember.role !== 'TA_SITE' || newMember.hrbpPts.length === 0) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (newMember.hrbpPts.includes(loc?.pt) && loc?.area === TA_SITE_AREA && loc?.areaDetail) {
        set.add(loc.areaDetail)
      }
    })
    return Array.from(set)
  }, [newMember.role, newMember.hrbpPts, officeLocations])

  const editTaSiteAreaDetailOptions = useMemo(() => {
    if (editMember.role !== 'TA_SITE' || editMember.hrbpPts.length === 0) return []
    const set = new Set<string>()
    officeLocations.forEach((loc) => {
      if (editMember.hrbpPts.includes(loc?.pt) && loc?.area === TA_SITE_AREA && loc?.areaDetail) {
        set.add(loc.areaDetail)
      }
    })
    return Array.from(set)
  }, [editMember.role, editMember.hrbpPts, officeLocations])

  const formatScopeValues = (value?: string | null) =>
    (value || '')
      .split('||')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    const delay = searchTerm ? 350 : 0
    const timer = setTimeout(() => {
      loadTeamMembers(searchTerm, roleFilter, areaFilter)
    }, delay)
    return () => clearTimeout(timer)
  }, [isLoading, isAuthenticated, searchTerm, roleFilter, areaFilter])

  const loadTeamMembers = async (search = '', role = 'all', area: UserAreaFilterType = 'ALL') => {
    try {
      setLoading(true)
      const members = await AdminUsersAPI.list(
        search,
        role !== 'all' ? role : undefined,
        area !== 'ALL' ? area : undefined
      )
      // Map API response to TeamMember format
      const mappedMembers: TeamMember[] = (members || [])
        .map((m: any) => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          phone: m.phoneNumber,
          role: m.role,
          division: m.division || '',
          sectionName: m.sectionName,
          isActive: m.isActive,
          lastLoginAt: m.lastLoginAt,
          pt: m.pt || '',
          area: m.area || '',
          areaDetail: m.areaDetail || '',
        }))
        // Candidates are managed via Candidate flows/portal, not User Management.
        .filter((m: TeamMember) => m.role !== 'CANDIDATE')
      setTeamMembers(mappedMembers)
    } catch (error) {
      console.error('Error loading team members:', error)
      alert('Failed to load team members. Please try again.')
      setTeamMembers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Load divisions from API
    const loadDivisions = async () => {
      try {
        const divs = await MasterDivisionAPI.getAll()
        setDivisions(divs.map((d: any) => ({
          id: d.id,
          divisionName: d.divisionName,
          sectionName: d.sectionName,
        })))
      } catch (error) {
        console.error('Error loading divisions:', error)
      }
    }

    const loadOfficeLocations = async () => {
      try {
        const locations = await MasterOfficeLocationAPI.getAll()
        setOfficeLocations(Array.isArray(locations) ? locations : [])
      } catch (error) {
        console.error('Error loading office locations:', error)
        setOfficeLocations([])
      }
    }

    loadDivisions()
    loadOfficeLocations()
    
    // Load default password from localStorage or use default (only in browser)
    if (typeof window !== 'undefined') {
      try {
        const storedDefaultPassword = localStorage.getItem('defaultPassword')
        if (storedDefaultPassword) {
          setDefaultPassword(storedDefaultPassword)
        }
      } catch (error) {
        console.warn('Could not load default password from localStorage:', error)
      }
    }
  }, [])

  // Load menuAccess config
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const cfg = JSON.parse(localStorage.getItem('menuAccess') || 'null') || {}
        setMenuAccessState(hydrateMenuAccess(cfg))
      } else {
        setMenuAccessState(defaultMenuAccessState)
      }
    } catch {
      setMenuAccessState(defaultMenuAccessState)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // Extract role name - handle both string and object formats
  let roleName = 'TA_HO'
  if (user) {
    if (typeof user.role === 'string') {
      roleName = user.role
    } else if (user.role?.name) {
      roleName = user.role.name
    }
  }
  
  // Check menu access permissions from localStorage
  const teamMenuAccess = menuAccessState['/team'] || defaultMenuAccessState['/team']
  const visibleRoles: string[] = teamMenuAccess.visibleRoles && teamMenuAccess.visibleRoles.length 
    ? teamMenuAccess.visibleRoles 
    : defaultMenuAccessState['/team'].visibleRoles
  const permissions = teamMenuAccess.permissions || defaultMenuAccessState['/team'].permissions
  const createRoles: string[] = permissions.create || []
  const editRoles: string[] = permissions.edit || []
  
  // Check if user can view (based on visible roles or default)
  const canViewTeam = visibleRoles.includes(roleName) || ['SUPER_ADMIN','TA_HO'].includes(roleName)
  
  // Check if user can edit (based on edit roles from menu access, or default permission)
  // If menu access has edit roles configured, use those. Otherwise, fall back to default.
  const hasEditRolesConfigured = editRoles.length > 0
  const canEditFromMenuAccess = hasEditRolesConfigured && editRoles.includes(roleName)
  const canEditFromDefault = ['SUPER_ADMIN','TA_HO'].includes(roleName)
  const canEditTeam = canEditFromMenuAccess || (!hasEditRolesConfigured && canEditFromDefault)
  
  // Check if user can create (based on create roles from menu access, or default permission)
  const hasCreateRolesConfigured = createRoles.length > 0
  const canCreateFromMenuAccess = hasCreateRolesConfigured && createRoles.includes(roleName)
  const canCreateFromDefault = ['SUPER_ADMIN','TA_HO'].includes(roleName)
  const canCreateTeam = canCreateFromMenuAccess || (!hasCreateRolesConfigured && canCreateFromDefault)
  
  const canManageMenu = roleName === 'SUPER_ADMIN'
  
  if (!canViewTeam) {
    router.push('/')
    return null
  }

  const filteredMembers = teamMembers

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-red-100 text-red-800'
      case 'Management':
        return 'bg-purple-100 text-purple-800'
      case 'Head of Division':
        return 'bg-blue-100 text-blue-800'
      case 'HRBP':
        return 'bg-green-100 text-green-800'
      case 'TA_HO':
        return 'bg-indigo-100 text-indigo-800'
      case 'TA_SITE':
        return 'bg-cyan-100 text-cyan-800'
      case 'HIRING_MANAGER':
        return 'bg-yellow-100 text-yellow-800'
      case 'INTERVIEWER':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const validateMember = (member: typeof newMember | typeof editMember, isEdit = false): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (!member.firstName?.trim()) {
      errors.firstName = 'First name is required'
    }
    if (!member.lastName?.trim()) {
      errors.lastName = 'Last name is required'
    }
    if (!member.email?.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
      errors.email = 'Invalid email format'
    }
    if (!isEdit && 'password' in member && !member.password?.trim()) {
      errors.password = 'Password is required'
    } else if (!isEdit && 'password' in member && member.password && member.password.trim().length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }
    if (member.role === 'Head of Division') {
      if (!member.hodDivisions?.length) {
        errors.hodDivisions = 'At least one division is required for Head of Division role'
      }
      if (!member.hodSections?.length) {
        errors.hodSections = 'At least one section is required for Head of Division role'
      }
    }
    if (member.role === 'HRBP') {
      if (!member.hrbpPts?.length) {
        errors.pt = 'At least one PT is required for HRBP role'
      }
      if (!member.hrbpAreas?.length) {
        errors.area = 'At least one Area is required for HRBP role'
      }
      if (!member.hrbpAreaDetails?.length) {
        errors.areaDetail = 'At least one Area Detail is required for HRBP role'
      }
    }
    if (member.role === 'TA_SITE') {
      if (!member.hrbpPts?.length) {
        errors.pt = 'At least one PT is required for TA_SITE role'
      }
      if (!member.hrbpAreaDetails?.length) {
        errors.areaDetail = 'At least one Area Detail is required for TA_SITE role'
      }
    }
    return errors
  }

  const handleEditClick = (member: TeamMember) => {
    setEditingMember(member)
    const isHoD = member.role === 'Head of Division'
    const isScopedSite = member.role === 'HRBP' || member.role === 'TA_SITE'
    setEditMember({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone || '',
      role: member.role,
      division: isHoD ? '' : (member.division || ''),
      sectionName: isHoD ? '' : (member.sectionName || ''),
      hodDivisions: isHoD ? (member.division ? member.division.split('||').filter(Boolean) : []) : [],
      hodSections: isHoD ? (member.sectionName ? member.sectionName.split('||').filter(Boolean) : []) : [],
      hrbpPts: isScopedSite ? (member.pt ? member.pt.split('||').filter(Boolean) : []) : [],
      hrbpAreas: member.role === 'HRBP' ? (member.area ? member.area.split('||').filter(Boolean) : []) : [],
      hrbpAreaDetails: isScopedSite ? (member.areaDetail ? member.areaDetail.split('||').filter(Boolean) : []) : [],
      pt: isScopedSite ? '' : (member.pt || ''),
      area: isScopedSite ? '' : (member.area || ''),
      areaDetail: isScopedSite ? '' : (member.areaDetail || ''),
      resetPassword: false
    })
    setValidationErrors({})
    setIsEditOpen(true)
  }

  const handleToggleActive = async (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId)
    if (!member) return
    await AdminUsersAPI.setStatus(memberId, !member.isActive)
    // Reload team members to get fresh data
    await loadTeamMembers(searchTerm, roleFilter, areaFilter)
  }

  const handleSaveMember = async () => {
    const errors = validateMember(newMember)
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors({})
    
    try {
      const isNewHoD = newMember.role === 'Head of Division'
      const isNewScopedSite = newMember.role === 'HRBP' || newMember.role === 'TA_SITE'
      const created = await AdminUsersAPI.create({
        firstName: newMember.firstName.trim(),
        lastName: newMember.lastName.trim(),
        email: newMember.email.trim(),
        phone: newMember.phone.trim() || undefined,
        role: newMember.role,
        division: isNewHoD ? newMember.hodDivisions.join('||') : (newMember.division || ''),
        sectionName: isNewHoD ? newMember.hodSections.join('||') : (newMember.sectionName || ''),
        password: newMember.password || defaultPassword,
        pt: isNewScopedSite ? newMember.hrbpPts.join('||') : (newMember.pt || ''),
        area: newMember.role === 'TA_SITE'
          ? TA_SITE_AREA
          : isNewScopedSite
            ? newMember.hrbpAreas.join('||')
            : (newMember.area || ''),
        areaDetail: isNewScopedSite ? newMember.hrbpAreaDetails.join('||') : (newMember.areaDetail || ''),
      })
      // Reload team members to get fresh data
      await loadTeamMembers(searchTerm, roleFilter, areaFilter)
      setIsAddOpen(false)
      setNewMember({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'TA_HO', division: '', sectionName: '', hodDivisions: [], hodSections: [], hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
      setValidationErrors({})
      setShowPassword(false)
      alert('Team member created successfully!')
    } catch (error: any) {
      console.error('Error creating team member:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create team member'
      alert(`Error: ${errorMessage}`)
      setValidationErrors({ submit: errorMessage })
    }
  }

  const handleUpdateMember = async () => {
    if (!editingMember) return
    
    const errors = validateMember(editMember, true)
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors({})
    
    try {
      const isEditHoD = editMember.role === 'Head of Division'
      const isEditScopedSite = editMember.role === 'HRBP' || editMember.role === 'TA_SITE'
      const updated = await AdminUsersAPI.update(editingMember.id, {
        firstName: editMember.firstName.trim(),
        lastName: editMember.lastName.trim(),
        email: editMember.email.trim(),
        phone: editMember.phone.trim() || undefined,
        role: editMember.role,
        division: isEditHoD ? editMember.hodDivisions.join('||') : (editMember.division || ''),
        sectionName: isEditHoD ? editMember.hodSections.join('||') : (editMember.sectionName || ''),
        pt: isEditScopedSite ? editMember.hrbpPts.join('||') : (editMember.pt || ''),
        area: editMember.role === 'TA_SITE'
          ? TA_SITE_AREA
          : isEditScopedSite
            ? editMember.hrbpAreas.join('||')
            : (editMember.area || ''),
        areaDetail: isEditScopedSite ? editMember.hrbpAreaDetails.join('||') : (editMember.areaDetail || ''),
      })
      if (editMember.resetPassword && canManageMenu) {
        await AdminUsersAPI.resetPassword(editingMember.id, defaultPassword)
      }
      // Reload team members to get fresh data
      await loadTeamMembers(searchTerm, roleFilter, areaFilter)
      setIsEditOpen(false)
      setEditingMember(null)
      setValidationErrors({})
      alert('Team member updated successfully!')
    } catch (error: any) {
      console.error('Error updating team member:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update team member'
      alert(`Error: ${errorMessage}`)
      setValidationErrors({ submit: errorMessage })
    }
  }

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage users and their roles in the recruitment system
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const blob = await AdminUsersAPI.downloadTemplate('xlsx')
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'user-management-upload-template.xlsx'
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    window.URL.revokeObjectURL(url)
                  } catch (e: any) {
                    console.error('Download template failed:', e)
                    alert(e.response?.data?.message || 'Failed to download template')
                  }
                }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Download Template
              </button>

              <label
                className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md ${
                  canCreateTeam ? 'text-gray-700 bg-white hover:bg-gray-50 cursor-pointer' : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  disabled={!canCreateTeam || uploadingUsers}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    if (!canCreateTeam) return
                    setUploadingUsers(true)
                    setUploadResult(null)
                    try {
                      const res = await AdminUsersAPI.bulkUpload(file)
                      setUploadResult(res?.data || res)
                      await loadTeamMembers(searchTerm, roleFilter, areaFilter)
                    } catch (err: any) {
                      console.error('Bulk upload failed:', err)
                      alert(err.response?.data?.message || 'Bulk upload failed')
                    } finally {
                      setUploadingUsers(false)
                    }
                  }}
                />
                {uploadingUsers ? 'Uploading...' : 'Upload Excel'}
              </label>

              <button
                disabled={!canCreateTeam}
                onClick={() => canCreateTeam && setIsAddOpen(true)}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${canCreateTeam ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' : 'bg-gray-300 cursor-not-allowed'}`}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add User
              </button>
            </div>
          </div>
        </div>

        {uploadResult && (
          <div className="mb-6 bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Upload Result</h3>
                <p className="text-xs text-gray-500">
                  Total: <span className="font-semibold">{uploadResult.total ?? 0}</span> • Succeeded:{' '}
                  <span className="font-semibold text-green-700">{uploadResult.created ?? 0}</span> • Errors:{' '}
                  <span className="font-semibold text-red-700">{uploadResult.failed ?? 0}</span>
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setUploadResult(null)}
              >
                Dismiss
              </button>
            </div>

            {Array.isArray(uploadResult.errors) && uploadResult.errors.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Row
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {uploadResult.errors.slice(0, 50).map((er: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-sm text-gray-900">{er.row}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{er.email || '-'}</td>
                        <td className="px-3 py-2 text-sm text-red-700">{er.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {uploadResult.errors.length > 50 && (
                  <p className="mt-2 text-xs text-gray-500">Showing first 50 errors.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-6 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:space-x-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="all">All Roles</option>
            {ROLE_OPTIONS.map(role => (
              <option key={role} value={role}>
                {role.replace('_', ' ')}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Area</span>
            <div className="inline-flex rounded-md shadow-sm">
              {USER_AREA_FILTERS.map((filter, index) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setAreaFilter(filter)}
                  className={`px-2.5 py-1.5 border text-xs font-medium ${
                    filter === areaFilter
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  } ${index === 0 ? 'rounded-l-md' : ''} ${
                    index === USER_AREA_FILTERS.length - 1 ? 'rounded-r-md' : ''
                  } ${index > 0 ? '-ml-px' : ''}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Team Members List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading users...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-6 text-center">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No users</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding users to the system.
              </p>
              <div className="mt-6">
                <button
                  disabled={!canCreateTeam}
                  onClick={() => canCreateTeam && setIsAddOpen(true)}
                  className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${canCreateTeam ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' : 'bg-gray-300 cursor-not-allowed'}`}
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add User
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredMembers.map((member) => (
                <li key={member.id}>
                  <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center flex-1">
                      <div className="flex-shrink-0">
                        {member.avatar ? (
                          <img
                            className="h-10 w-10 rounded-full"
                            src={member.avatar}
                            alt={`${member.firstName} ${member.lastName}`}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600">
                              {getInitials(member.firstName, member.lastName)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                            </p>
                            <div className="flex items-center text-sm text-gray-500">
                              <EnvelopeIcon className="h-4 w-4 mr-1" />
                              <span>{member.email}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                              {member.role.replace('_', ' ')}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              member.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {member.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <BriefcaseIcon className="h-4 w-4 mr-1" />
                          <span>
                            {member.role === 'Head of Division'
                              ? [
                                  formatScopeValues(member.division !== '-' ? member.division : ''),
                                  formatScopeValues(member.sectionName && member.sectionName !== '-' ? member.sectionName : ''),
                                ].filter(Boolean).join(' • ') || '—'
                              : `${member.division || '—'}${member.sectionName && member.sectionName !== '-' ? ` • ${member.sectionName}` : ''}`}
                          </span>
                          {member.phone && (
                            <>
                              <PhoneIcon className="h-4 w-4 ml-3 mr-1" />
                              <span>{member.phone}</span>
                            </>
                          )}
                        </div>
                        {(member.pt || member.area || member.areaDetail) && (
                          <div className="mt-1 text-sm text-gray-500">
                            <p>
                              {[
                                formatScopeValues(member.pt),
                                formatScopeValues(member.area),
                                formatScopeValues(member.areaDetail),
                              ].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                        )}
                        <div className="mt-1 text-sm text-gray-500">
                          {member.lastLoginAt ? (
                            <p>Last login: {new Date(member.lastLoginAt).toLocaleDateString()}</p>
                          ) : (
                            <p>Never logged in</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button 
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (canEditTeam) {
                            handleEditClick(member)
                          }
                        }}
                        className={`text-sm font-medium ${canEditTeam ? 'text-indigo-600 hover:text-indigo-900 cursor-pointer' : 'text-gray-300 cursor-not-allowed pointer-events-none'}`}
                        type="button"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (canEditTeam) {
                            handleToggleActive(member.id)
                          }
                        }}
                        className={`text-sm font-medium ${canEditTeam ? 'text-gray-400 hover:text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed pointer-events-none'}`}
                        type="button"
                      >
                        {member.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Menu Access Management (SUPER_ADMIN only) */}
        {canManageMenu && (
          <div className="mt-8 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Menu Access Management</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Menu</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Visible Roles</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Create</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {routes.map((r) => {
                      const row = menuAccessState[r.path] || defaultMenuAccessState[r.path]
                      const visibleRoles = row.visibleRoles && row.visibleRoles.length ? row.visibleRoles : r.defaults.visibleRoles
                      const permissions = row.permissions || r.defaults.permissions
                      const createRoles = permissions.create || []
                      const editRoles = permissions.edit || []
                      const updateState = (key: 'visibleRoles' | 'create' | 'edit', role: string, checked: boolean) => {
                        setMenuAccessState((prev) => {
                          const current = prev[r.path] || defaultMenuAccessState[r.path] || { visibleRoles: [], permissions: { create: [], edit: [] } }
                          if (key === 'visibleRoles') {
                            const nextVisible = new Set(current.visibleRoles && current.visibleRoles.length ? current.visibleRoles : r.defaults.visibleRoles)
                            checked ? nextVisible.add(role) : nextVisible.delete(role)
                            return {
                              ...prev,
                              [r.path]: {
                                ...current,
                                visibleRoles: Array.from(nextVisible),
                              },
                            }
                          }

                          const currentPermSet = new Set(
                            key === 'create'
                              ? (current.permissions.create && current.permissions.create.length ? current.permissions.create : r.defaults.permissions.create)
                              : (current.permissions.edit && current.permissions.edit.length ? current.permissions.edit : r.defaults.permissions.edit)
                          )
                          checked ? currentPermSet.add(role) : currentPermSet.delete(role)

                          const updatedPermissions = {
                            ...current.permissions,
                            [key]: Array.from(currentPermSet),
                          }

                          return {
                            ...prev,
                            [r.path]: {
                              ...current,
                              permissions: updatedPermissions,
                            },
                          }
                        })
                      }
                      return (
                        <tr key={r.path}>
                          <td className="px-4 py-2 text-sm text-gray-900">{r.label}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-2">
                              {allRoles.map((role) => (
                                <label key={role} className="inline-flex items-center gap-1 text-xs text-gray-700">
                                  <input type="checkbox" checked={visibleRoles.includes(role)} onChange={(e) => updateState('visibleRoles', role, e.target.checked)} />
                                  <span>{role}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-2">
                              {allRoles.map((role) => (
                                <label key={role} className="inline-flex items-center gap-1 text-xs text-gray-700">
                                  <input type="checkbox" checked={createRoles.includes(role)} onChange={(e) => updateState('create', role, e.target.checked)} />
                                  <span>{role}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-2">
                              {allRoles.map((role) => (
                                <label key={role} className="inline-flex items-center gap-1 text-xs text-gray-700">
                                  <input type="checkbox" checked={editRoles.includes(role)} onChange={(e) => updateState('edit', role, e.target.checked)} />
                                  <span>{role}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveMenuAccess}
                  className="px-4 py-2 text-sm rounded-md border border-transparent text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Save Access Rules
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Add Member Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => {
            setIsAddOpen(false)
            setValidationErrors({})
            setShowPassword(false)
            setNewMember({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'TA_HO', division: '', sectionName: '', hodDivisions: [], hodSections: [], hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
          }}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Add User</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => {
                  setIsAddOpen(false)
                  setValidationErrors({})
                  setShowPassword(false)
                  setNewMember({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'TA_HO', division: '', sectionName: '', hodDivisions: [], hodSections: [], hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
                }}>✕</button>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input 
                      className={`w-full border rounded-md px-3 py-2 text-sm ${validationErrors.firstName ? 'border-red-500' : ''}`} 
                      value={newMember.firstName} 
                      onChange={(e) => {
                        setNewMember({ ...newMember, firstName: e.target.value })
                        if (validationErrors.firstName) {
                          setValidationErrors({ ...validationErrors, firstName: '' })
                        }
                      }} 
                    />
                    {validationErrors.firstName && (
                      <p className="mt-1 text-sm text-red-500">{validationErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                    <input 
                      className={`w-full border rounded-md px-3 py-2 text-sm ${validationErrors.lastName ? 'border-red-500' : ''}`} 
                      value={newMember.lastName} 
                      onChange={(e) => {
                        setNewMember({ ...newMember, lastName: e.target.value })
                        if (validationErrors.lastName) {
                          setValidationErrors({ ...validationErrors, lastName: '' })
                        }
                      }} 
                    />
                    {validationErrors.lastName && (
                      <p className="mt-1 text-sm text-red-500">{validationErrors.lastName}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input 
                    type="email" 
                    className={`w-full border rounded-md px-3 py-2 text-sm ${validationErrors.email ? 'border-red-500' : ''}`} 
                    value={newMember.email} 
                    onChange={(e) => {
                      setNewMember({ ...newMember, email: e.target.value })
                      if (validationErrors.email) {
                        setValidationErrors({ ...validationErrors, email: '' })
                      }
                    }} 
                  />
                  {validationErrors.email && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Default Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className={`w-full border rounded-md px-3 py-2 pr-10 text-sm ${validationErrors.password ? 'border-red-500' : ''}`} 
                      value={newMember.password} 
                      onChange={(e) => {
                        setNewMember({ ...newMember, password: e.target.value })
                        if (validationErrors.password) {
                          setValidationErrors({ ...validationErrors, password: '' })
                        }
                      }}
                      placeholder="Set default password (user must change on first login)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {validationErrors.password && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors.password}</p>
                  )}
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-gray-500">User will be required to change this password on first login</p>
                    <button
                      type="button"
                      onClick={() => {
                        // Generate a random password
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
                        const password = Array.from(crypto.getRandomValues(new Uint8Array(12)))
                          .map(x => chars[x % chars.length])
                          .join('')
                        setNewMember({ ...newMember, password })
                        if (validationErrors.password) {
                          setValidationErrors({ ...validationErrors, password: '' })
                        }
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Generate Password
                    </button>
                  </div>
                  {newMember.password && (
                    <p className="mt-1 text-xs text-gray-600">
                      Password strength: {newMember.password.length < 6 ? 'Weak' : newMember.password.length < 10 ? 'Medium' : 'Strong'}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Phone</label>
                    <input className="w-full border rounded-md px-3 py-2 text-sm" value={newMember.phone} onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Role</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={newMember.role}
                      onChange={(e) => {
                        const newRole = e.target.value
                        if (newRole === 'Head of Division') {
                          setNewMember({ ...newMember, role: newRole, division: '', sectionName: '', hodDivisions: [], hodSections: [], hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
                        } else if (newRole === 'TA_SITE') {
                          setNewMember({ ...newMember, role: newRole, hodDivisions: [], hodSections: [], division: '', sectionName: '', hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
                        } else if (newRole === 'HRBP') {
                          setNewMember({ ...newMember, role: newRole, hodDivisions: [], hodSections: [], division: '', sectionName: '', hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
                        } else {
                          setNewMember({ ...newMember, role: newRole, hodDivisions: [], hodSections: [], hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [] })
                        }
                      }}
                    >
                      {ROLE_OPTIONS.map(role => (
                        <option key={role} value={role}>
                          {role.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {newMember.role === 'Head of Division' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <MultiSelectDropdown
                        label="Division *"
                        options={uniqueDivisionOptions}
                        value={newMember.hodDivisions}
                        onChange={(vals) => {
                          const removed = newMember.hodDivisions.filter(d => !vals.includes(d))
                          const sectionsToKeep = newMember.hodSections.filter(sec =>
                            divisions.some(d => vals.includes(d.divisionName) && d.sectionName === sec)
                          )
                          setNewMember({ ...newMember, hodDivisions: vals, hodSections: removed.length ? sectionsToKeep : newMember.hodSections })
                          if (validationErrors.hodDivisions) {
                            setValidationErrors({ ...validationErrors, hodDivisions: '' })
                          }
                        }}
                        placeholder="Select Divisions"
                        searchPlaceholder="Search divisions..."
                      />
                      {validationErrors.hodDivisions && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.hodDivisions}</p>
                      )}
                    </div>
                    <div>
                      <MultiSelectDropdown
                        label="Section Name *"
                        options={newHodSectionOptions}
                        value={newMember.hodSections}
                        onChange={(vals) => {
                          setNewMember({ ...newMember, hodSections: vals })
                          if (validationErrors.hodSections) {
                            setValidationErrors({ ...validationErrors, hodSections: '' })
                          }
                        }}
                        placeholder={newMember.hodDivisions.length === 0 ? 'Select Division first' : 'Select Sections'}
                        searchPlaceholder="Search sections..."
                      />
                      {validationErrors.hodSections && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.hodSections}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Division</label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={newMember.division} onChange={(e) => setNewMember({ ...newMember, division: e.target.value, sectionName: '' })}>
                      <option value="">Select Division</option>
                      {uniqueDivisionOptions.map((div) => (
                        <option key={div} value={div}>{div}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Section Name</label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={newMember.sectionName} onChange={(e) => setNewMember({ ...newMember, sectionName: e.target.value })}>
                      <option value="">Select Section</option>
                      {divisions.filter(d => d.divisionName === newMember.division).map((d) => (
                        <option key={d.id} value={d.sectionName}>{d.sectionName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                )}
                {newMember.role === 'TA_SITE' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <MultiSelectDropdown
                        label="PT *"
                        options={ptOptions}
                        value={newMember.hrbpPts}
                        onChange={(vals) => {
                          const detailsToKeep = newMember.hrbpAreaDetails.filter((detail) =>
                            officeLocations.some(
                              (loc) =>
                                vals.includes(loc?.pt) &&
                                loc?.area === TA_SITE_AREA &&
                                loc?.areaDetail === detail
                            )
                          )
                          setNewMember({
                            ...newMember,
                            hrbpPts: vals,
                            hrbpAreaDetails: detailsToKeep,
                          })
                          if (validationErrors.pt) {
                            setValidationErrors({ ...validationErrors, pt: '' })
                          }
                        }}
                        placeholder="Select PT"
                        searchPlaceholder="Search PT..."
                      />
                      {validationErrors.pt && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.pt}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Area</label>
                      <div className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-700">
                        {TA_SITE_AREA}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">TA Site users are always scoped to Site area.</p>
                    </div>
                    <div>
                      <MultiSelectDropdown
                        label="Area Detail *"
                        options={newTaSiteAreaDetailOptions}
                        value={newMember.hrbpAreaDetails}
                        onChange={(vals) => {
                          setNewMember({ ...newMember, hrbpAreaDetails: vals })
                          if (validationErrors.areaDetail) {
                            setValidationErrors({ ...validationErrors, areaDetail: '' })
                          }
                        }}
                        placeholder={newMember.hrbpPts.length === 0 ? 'Select PT first' : 'Select Area Detail'}
                        searchPlaceholder="Search area details..."
                      />
                      {validationErrors.areaDetail && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.areaDetail}</p>
                      )}
                    </div>
                  </div>
                ) : newMember.role === 'HRBP' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <MultiSelectDropdown
                        label="PT *"
                        options={ptOptions}
                        value={newMember.hrbpPts}
                        onChange={(vals) => {
                          const areasToKeep = newMember.hrbpAreas.filter((area) =>
                            officeLocations.some((loc) => vals.includes(loc?.pt) && loc?.area === area)
                          )
                          const detailsToKeep = newMember.hrbpAreaDetails.filter((detail) =>
                            officeLocations.some(
                              (loc) =>
                                vals.includes(loc?.pt) &&
                                areasToKeep.includes(loc?.area) &&
                                loc?.areaDetail === detail
                            )
                          )
                          setNewMember({
                            ...newMember,
                            hrbpPts: vals,
                            hrbpAreas: areasToKeep,
                            hrbpAreaDetails: detailsToKeep,
                          })
                          if (validationErrors.pt) {
                            setValidationErrors({ ...validationErrors, pt: '' })
                          }
                        }}
                        placeholder="Select PT"
                        searchPlaceholder="Search PT..."
                      />
                      {validationErrors.pt && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.pt}</p>
                      )}
                    </div>
                    <div>
                      <MultiSelectDropdown
                        label="Area *"
                        options={newScopedAreaOptions}
                        value={newMember.hrbpAreas}
                        onChange={(vals) => {
                          const detailsToKeep = newMember.hrbpAreaDetails.filter((detail) =>
                            officeLocations.some(
                              (loc) =>
                                newMember.hrbpPts.includes(loc?.pt) &&
                                vals.includes(loc?.area) &&
                                loc?.areaDetail === detail
                            )
                          )
                          setNewMember({ ...newMember, hrbpAreas: vals, hrbpAreaDetails: detailsToKeep })
                          if (validationErrors.area) {
                            setValidationErrors({ ...validationErrors, area: '' })
                          }
                        }}
                        placeholder={newMember.hrbpPts.length === 0 ? 'Select PT first' : 'Select Area'}
                        searchPlaceholder="Search areas..."
                      />
                      {validationErrors.area && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.area}</p>
                      )}
                    </div>
                    <div>
                      <MultiSelectDropdown
                        label="Area Detail *"
                        options={newScopedAreaDetailOptions}
                        value={newMember.hrbpAreaDetails}
                        onChange={(vals) => {
                          setNewMember({ ...newMember, hrbpAreaDetails: vals })
                          if (validationErrors.areaDetail) {
                            setValidationErrors({ ...validationErrors, areaDetail: '' })
                          }
                        }}
                        placeholder={
                          newMember.hrbpAreas.length === 0 ? 'Select Area first' : 'Select Area Detail'
                        }
                        searchPlaceholder="Search area details..."
                      />
                      {validationErrors.areaDetail && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.areaDetail}</p>
                      )}
                    </div>
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">PT</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={newMember.pt}
                      onChange={(e) => {
                        setNewMember({ ...newMember, pt: e.target.value, area: '', areaDetail: '' })
                      }}
                    >
                      <option value="">Select PT</option>
                      {ptOptions.map((pt) => (
                        <option key={pt} value={pt}>
                          {pt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Area</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={newMember.area}
                      onChange={(e) => {
                        setNewMember({ ...newMember, area: e.target.value, areaDetail: '' })
                      }}
                      disabled={!newMember.pt || newMemberAreaOptions.length === 0}
                    >
                      <option value="">{newMember.pt ? 'Select Area' : 'Select PT first'}</option>
                      {newMemberAreaOptions.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Area Detail</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={newMember.areaDetail}
                      onChange={(e) => {
                        setNewMember({ ...newMember, areaDetail: e.target.value })
                      }}
                      disabled={!newMember.area || newMemberAreaDetailOptions.length === 0}
                    >
                      <option value="">{newMember.area ? 'Select Area Detail' : 'Select Area first'}</option>
                      {newMemberAreaDetailOptions.map((detail) => (
                        <option key={detail} value={detail}>
                          {detail}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                )}
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-2">
                <button 
                  className="px-4 py-2 text-sm rounded-md border text-gray-700 bg-white hover:bg-gray-50" 
                  onClick={() => {
                    setIsAddOpen(false)
                    setValidationErrors({})
                    setShowPassword(false)
                    setNewMember({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'TA_HO', division: '', sectionName: '', hodDivisions: [], hodSections: [], hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm rounded-md border border-transparent text-white bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleSaveMember}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Member Modal */}
        {isEditOpen && editingMember && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => {
            setIsEditOpen(false)
            setValidationErrors({})
          }}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => {
                  setIsEditOpen(false)
                  setValidationErrors({})
                }}>✕</button>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input 
                      className={`w-full border rounded-md px-3 py-2 text-sm ${validationErrors.firstName ? 'border-red-500' : ''}`} 
                      value={editMember.firstName} 
                      onChange={(e) => {
                        setEditMember({ ...editMember, firstName: e.target.value })
                        if (validationErrors.firstName) {
                          setValidationErrors({ ...validationErrors, firstName: '' })
                        }
                      }} 
                    />
                    {validationErrors.firstName && (
                      <p className="mt-1 text-sm text-red-500">{validationErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                    <input 
                      className={`w-full border rounded-md px-3 py-2 text-sm ${validationErrors.lastName ? 'border-red-500' : ''}`} 
                      value={editMember.lastName} 
                      onChange={(e) => {
                        setEditMember({ ...editMember, lastName: e.target.value })
                        if (validationErrors.lastName) {
                          setValidationErrors({ ...validationErrors, lastName: '' })
                        }
                      }} 
                    />
                    {validationErrors.lastName && (
                      <p className="mt-1 text-sm text-red-500">{validationErrors.lastName}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input 
                    type="email" 
                    className={`w-full border rounded-md px-3 py-2 text-sm ${validationErrors.email ? 'border-red-500' : ''}`} 
                    value={editMember.email} 
                    onChange={(e) => {
                      setEditMember({ ...editMember, email: e.target.value })
                      if (validationErrors.email) {
                        setValidationErrors({ ...validationErrors, email: '' })
                      }
                    }} 
                  />
                  {validationErrors.email && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors.email}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Phone</label>
                    <input className="w-full border rounded-md px-3 py-2 text-sm" value={editMember.phone} onChange={(e) => setEditMember({ ...editMember, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Role</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={editMember.role}
                      onChange={(e) => {
                        const newRole = e.target.value
                        if (newRole === 'Head of Division') {
                          setEditMember({ ...editMember, role: newRole, division: '', sectionName: '', hodDivisions: [], hodSections: [], hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
                        } else if (newRole === 'TA_SITE') {
                          setEditMember({ ...editMember, role: newRole, hodDivisions: [], hodSections: [], division: '', sectionName: '', hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
                        } else if (newRole === 'HRBP') {
                          setEditMember({ ...editMember, role: newRole, hodDivisions: [], hodSections: [], division: '', sectionName: '', hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [], pt: '', area: '', areaDetail: '' })
                        } else {
                          setEditMember({ ...editMember, role: newRole, hodDivisions: [], hodSections: [], hrbpPts: [], hrbpAreas: [], hrbpAreaDetails: [] })
                        }
                      }}
                    >
                      {ROLE_OPTIONS.map(role => (
                        <option key={role} value={role}>
                          {role.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {editMember.role === 'Head of Division' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <MultiSelectDropdown
                        label="Division *"
                        options={uniqueDivisionOptions}
                        value={editMember.hodDivisions}
                        onChange={(vals) => {
                          const sectionsToKeep = editMember.hodSections.filter(sec =>
                            divisions.some(d => vals.includes(d.divisionName) && d.sectionName === sec)
                          )
                          setEditMember({ ...editMember, hodDivisions: vals, hodSections: sectionsToKeep })
                          if (validationErrors.hodDivisions) {
                            setValidationErrors({ ...validationErrors, hodDivisions: '' })
                          }
                        }}
                        placeholder="Select Divisions"
                        searchPlaceholder="Search divisions..."
                      />
                      {validationErrors.hodDivisions && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.hodDivisions}</p>
                      )}
                    </div>
                    <div>
                      <MultiSelectDropdown
                        label="Section Name *"
                        options={editHodSectionOptions}
                        value={editMember.hodSections}
                        onChange={(vals) => {
                          setEditMember({ ...editMember, hodSections: vals })
                          if (validationErrors.hodSections) {
                            setValidationErrors({ ...validationErrors, hodSections: '' })
                          }
                        }}
                        placeholder={editMember.hodDivisions.length === 0 ? 'Select Division first' : 'Select Sections'}
                        searchPlaceholder="Search sections..."
                      />
                      {validationErrors.hodSections && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.hodSections}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Division</label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={editMember.division} onChange={(e) => setEditMember({ ...editMember, division: e.target.value, sectionName: '' })}>
                      <option value="">Select Division</option>
                      {uniqueDivisionOptions.map((div) => (
                        <option key={div} value={div}>{div}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Section Name</label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={editMember.sectionName} onChange={(e) => setEditMember({ ...editMember, sectionName: e.target.value })}>
                      <option value="">Select Section</option>
                      {divisions.filter(d => d.divisionName === editMember.division).map((d) => (
                        <option key={d.id} value={d.sectionName}>{d.sectionName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                )}
                {editMember.role === 'TA_SITE' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <MultiSelectDropdown
                        label="PT *"
                        options={ptOptions}
                        value={editMember.hrbpPts}
                        onChange={(vals) => {
                          const detailsToKeep = editMember.hrbpAreaDetails.filter((detail) =>
                            officeLocations.some(
                              (loc) =>
                                vals.includes(loc?.pt) &&
                                loc?.area === TA_SITE_AREA &&
                                loc?.areaDetail === detail
                            )
                          )
                          setEditMember({
                            ...editMember,
                            hrbpPts: vals,
                            hrbpAreaDetails: detailsToKeep,
                          })
                          if (validationErrors.pt) {
                            setValidationErrors({ ...validationErrors, pt: '' })
                          }
                        }}
                        placeholder="Select PT"
                        searchPlaceholder="Search PT..."
                      />
                      {validationErrors.pt && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.pt}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Area</label>
                      <div className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-700">
                        {TA_SITE_AREA}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">TA Site users are always scoped to Site area.</p>
                    </div>
                    <div>
                      <MultiSelectDropdown
                        label="Area Detail *"
                        options={editTaSiteAreaDetailOptions}
                        value={editMember.hrbpAreaDetails}
                        onChange={(vals) => {
                          setEditMember({ ...editMember, hrbpAreaDetails: vals })
                          if (validationErrors.areaDetail) {
                            setValidationErrors({ ...validationErrors, areaDetail: '' })
                          }
                        }}
                        placeholder={editMember.hrbpPts.length === 0 ? 'Select PT first' : 'Select Area Detail'}
                        searchPlaceholder="Search area details..."
                      />
                      {validationErrors.areaDetail && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.areaDetail}</p>
                      )}
                    </div>
                  </div>
                ) : editMember.role === 'HRBP' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <MultiSelectDropdown
                        label="PT *"
                        options={ptOptions}
                        value={editMember.hrbpPts}
                        onChange={(vals) => {
                          const areasToKeep = editMember.hrbpAreas.filter((area) =>
                            officeLocations.some((loc) => vals.includes(loc?.pt) && loc?.area === area)
                          )
                          const detailsToKeep = editMember.hrbpAreaDetails.filter((detail) =>
                            officeLocations.some(
                              (loc) =>
                                vals.includes(loc?.pt) &&
                                areasToKeep.includes(loc?.area) &&
                                loc?.areaDetail === detail
                            )
                          )
                          setEditMember({
                            ...editMember,
                            hrbpPts: vals,
                            hrbpAreas: areasToKeep,
                            hrbpAreaDetails: detailsToKeep,
                          })
                          if (validationErrors.pt) {
                            setValidationErrors({ ...validationErrors, pt: '' })
                          }
                        }}
                        placeholder="Select PT"
                        searchPlaceholder="Search PT..."
                      />
                      {validationErrors.pt && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.pt}</p>
                      )}
                    </div>
                    <div>
                      <MultiSelectDropdown
                        label="Area *"
                        options={editScopedAreaOptions}
                        value={editMember.hrbpAreas}
                        onChange={(vals) => {
                          const detailsToKeep = editMember.hrbpAreaDetails.filter((detail) =>
                            officeLocations.some(
                              (loc) =>
                                editMember.hrbpPts.includes(loc?.pt) &&
                                vals.includes(loc?.area) &&
                                loc?.areaDetail === detail
                            )
                          )
                          setEditMember({ ...editMember, hrbpAreas: vals, hrbpAreaDetails: detailsToKeep })
                          if (validationErrors.area) {
                            setValidationErrors({ ...validationErrors, area: '' })
                          }
                        }}
                        placeholder={editMember.hrbpPts.length === 0 ? 'Select PT first' : 'Select Area'}
                        searchPlaceholder="Search areas..."
                      />
                      {validationErrors.area && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.area}</p>
                      )}
                    </div>
                    <div>
                      <MultiSelectDropdown
                        label="Area Detail *"
                        options={editScopedAreaDetailOptions}
                        value={editMember.hrbpAreaDetails}
                        onChange={(vals) => {
                          setEditMember({ ...editMember, hrbpAreaDetails: vals })
                          if (validationErrors.areaDetail) {
                            setValidationErrors({ ...validationErrors, areaDetail: '' })
                          }
                        }}
                        placeholder={
                          editMember.hrbpAreas.length === 0 ? 'Select Area first' : 'Select Area Detail'
                        }
                        searchPlaceholder="Search area details..."
                      />
                      {validationErrors.areaDetail && (
                        <p className="mt-1 text-sm text-red-500">{validationErrors.areaDetail}</p>
                      )}
                    </div>
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">PT</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={editMember.pt}
                      onChange={(e) => {
                        setEditMember({ ...editMember, pt: e.target.value, area: '', areaDetail: '' })
                      }}
                    >
                      <option value="">Select PT</option>
                      {ptOptions.map((pt) => (
                        <option key={pt} value={pt}>
                          {pt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Area</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={editMember.area}
                      onChange={(e) => {
                        setEditMember({ ...editMember, area: e.target.value, areaDetail: '' })
                      }}
                      disabled={!editMember.pt || editMemberAreaOptions.length === 0}
                    >
                      <option value="">{editMember.pt ? 'Select Area' : 'Select PT first'}</option>
                      {editMemberAreaOptions.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Area Detail</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={editMember.areaDetail}
                      onChange={(e) => {
                        setEditMember({ ...editMember, areaDetail: e.target.value })
                      }}
                      disabled={!editMember.area || editMemberAreaDetailOptions.length === 0}
                    >
                      <option value="">{editMember.area ? 'Select Area Detail' : 'Select Area first'}</option>
                      {editMemberAreaDetailOptions.map((detail) => (
                        <option key={detail} value={detail}>
                          {detail}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                )}
                {canManageMenu && (
                  <div className="border-t pt-3 mt-3 space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="resetPassword"
                        checked={editMember.resetPassword || false}
                        onChange={(e) => {
                          const newValue = e.target.checked
                          console.log('Reset password checkbox changed:', newValue)
                          setEditMember({ ...editMember, resetPassword: newValue })
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="resetPassword" className="ml-2 block text-sm text-gray-700">
                        Reset Password to Default (user must change on first login)
                      </label>
                    </div>
                    {editMember.resetPassword === true && (
                      <div className="ml-6 space-y-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Default Password:</label>
                          <div className="relative">
                            <input
                              type={showDefaultPassword ? "text" : "password"}
                              value={defaultPassword}
                              onChange={(e) => {
                                setDefaultPassword(e.target.value)
                                if (typeof window !== 'undefined') {
                                  try {
                                    localStorage.setItem('defaultPassword', e.target.value)
                                  } catch (error) {
                                    console.warn('Could not save default password to localStorage:', error)
                                  }
                                }
                              }}
                              className="w-full border rounded-md px-3 py-2 text-sm pr-10"
                              placeholder="Enter default password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowDefaultPassword(!showDefaultPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                              {showDefaultPassword ? (
                                <EyeSlashIcon className="h-5 w-5" />
                              ) : (
                                <EyeIcon className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            This password will be set when you save. The user will be required to change it on their first login.
                          </p>
                        </div>
                      </div>
                    )}
                    {!editMember.resetPassword && (
                      <p className="mt-1 text-xs text-gray-500 ml-6">
                        If checked, the user's password will be reset to the default password and they will be required to change it on their next login.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-2">
                <button 
                  className="px-4 py-2 text-sm rounded-md border text-gray-700 bg-white hover:bg-gray-50" 
                  onClick={() => {
                    setIsEditOpen(false)
                    setValidationErrors({})
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm rounded-md border border-transparent text-white bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleUpdateMember}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
