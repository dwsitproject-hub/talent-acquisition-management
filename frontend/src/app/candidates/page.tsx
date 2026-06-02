'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useModalEscape } from '@/hooks/useModalEscape'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import AddCandidateModal from '@/components/AddCandidateModal'
import SimpleAddCandidateModal from '@/components/SimpleAddCandidateModal'
import BasicModal from '@/components/BasicModal'
import UltraSimpleModal from '@/components/UltraSimpleModal'
import SimpleFormModal from '@/components/SimpleFormModal'
import EnhancedAddCandidateModal from '@/components/EnhancedAddCandidateModal'
import ViewCandidateModal from '@/components/ViewCandidateModal'
import EditCandidateModal from '@/components/EditCandidateModal'
import StepByStepModal from '@/components/StepByStepModal'
import WorkingAddCandidateModal from '@/components/WorkingAddCandidateModal'
import TestModal from '@/components/TestModal'
import { PlusIcon, MagnifyingGlassIcon, LinkIcon } from '@heroicons/react/24/outline'
import { Candidate, CandidateStatus, CandidateFile } from '@/types'
import { saveCandidateLink } from '@/utils/candidateLink'
import { matchesTokenizedSearch } from '@/utils/search'
import { CandidatesAPI, MenuAccessAPI } from '@/lib/api'
import BulkUploadModal from '@/components/BulkUploadModal'
import { getCandidateDivisions, getCandidateYearsOfExperience, getCandidateSkills, parseLanguagesData } from '@/utils/candidateProfileShape'

const mapEnumToRole = (role: string): string => {
  if (!role) return role
  const roleMap: Record<string, string> = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    CHRO: 'Management',
    DEPARTMENT_HEAD: 'Head of Division',
    HRBP: 'HRBP',
    TA_TEAM: 'TA_TEAM',
    HIRING_MANAGER: 'HIRING_MANAGER',
    INTERVIEWER: 'INTERVIEWER',
    CANDIDATE: 'CANDIDATE',
  }
  return roleMap[role] || role
}

const mockCandidates: Candidate[] = [
  {
    id: '1',
    userId: '1',
    user: {
      id: '1',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: { id: '1', name: 'Candidate', permissions: [] },
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    personalInfo: {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      gender: 'Male',
      nationality: 'US',
    },
    contactInfo: {
      email: 'john.doe@example.com',
      phone: '+1-555-0123',
      city: 'New York',
      state: 'NY',
      country: 'US',
    },
    professionalInfo: {
      currentPosition: 'Software Engineer',
      currentCompany: 'Tech Corp',
      experience: 5,
      skills: ['React', 'Node.js', 'TypeScript'],
      education: [],
      workHistory: [],
      certifications: [],
    },
    applicationInfo: {
      appliedDate: '2024-01-01T00:00:00Z',
      source: 'LinkedIn',
      status: 'new',
    },
    status: 'new',
    source: 'LinkedIn',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    userId: '2',
    user: {
      id: '2',
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: { id: '1', name: 'Candidate', permissions: [] },
      isActive: true,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    personalInfo: {
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: '1985-05-15',
      gender: 'Female',
      nationality: 'US',
    },
    contactInfo: {
      email: 'jane.smith@example.com',
      phone: '+1-555-0124',
      city: 'San Francisco',
      state: 'CA',
      country: 'US',
    },
    professionalInfo: {
      currentPosition: 'Product Manager',
      currentCompany: 'Startup Inc',
      experience: 8,
      skills: ['Product Management', 'Agile', 'Analytics'],
      education: [],
      workHistory: [],
      certifications: [],
    },
    applicationInfo: {
      appliedDate: '2024-01-02T00:00:00Z',
      source: 'Indeed',
      status: 'screening',
    },
    status: 'screening',
    source: 'Indeed',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
]

const statusColors: Record<CandidateStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  screening: 'bg-yellow-100 text-yellow-800',
  interview_scheduled: 'bg-purple-100 text-purple-800',
  interviewed: 'bg-indigo-100 text-indigo-800',
  shortlisted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  hired: 'bg-emerald-100 text-emerald-800',
  withdrawn: 'bg-gray-100 text-gray-800',
}

const mapDocumentsToFiles = (documents: any[] = []): CandidateFile[] => {
  console.log('mapDocumentsToFiles - Input documents:', documents?.length, documents)
  const mapped = documents
    .filter((doc) => !!doc)
    .map((doc) => {
      const documentType = String(doc.documentType || '').toUpperCase()
      let type: CandidateFile['type'] = 'other'
      if (documentType === 'RESUME') {
        type = 'cv'
      } else if (documentType === 'FORM_DATA') {
        type = 'form_data'
      }
      // All other types (including 'OTHER') map to 'other'

      return {
        id: doc.id,
        name: doc.originalName || doc.fileName || 'Document',
        type,
        url: doc.fileUrl || undefined,
        mimeType: doc.mimeType || undefined,
        size: typeof doc.fileSize === 'number' ? doc.fileSize : undefined,
        uploadedAt: doc.uploadedAt || doc.updatedAt || doc.createdAt || new Date().toISOString(),
      }
    })
  console.log('mapDocumentsToFiles - Mapped files:', mapped?.length, mapped)
  return mapped
}

const parseFormDataDiri = (value: any) => {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  if (typeof value === 'object') {
    return value
  }
  return null
}

const normalizeDrivingLicense = (value: any, formData?: any) => {
  if (Array.isArray(value) && value.length > 0) return value.join(' & ')
  if (typeof value === 'string' && value.trim()) return value
  if (formData) {
    if (Array.isArray(formData.drivingLicense) && formData.drivingLicense.length > 0) {
      return formData.drivingLicense.join(' & ')
    }
    if (typeof formData.drivingLicense === 'string' && formData.drivingLicense.trim()) {
      return formData.drivingLicense
    }
  }
  return ''
}

const parsePositionAppliedFor = (candidate: any, languagesData?: any) => {
  let positionAppliedFor: string[] = []
  if (candidate.positionAppliedFor !== undefined && candidate.positionAppliedFor !== null) {
    if (Array.isArray(candidate.positionAppliedFor)) {
      positionAppliedFor = candidate.positionAppliedFor
    } else if (candidate.positionAppliedFor) {
      positionAppliedFor = [String(candidate.positionAppliedFor)]
    }
  } else if (languagesData && languagesData.positionAppliedFor) {
    positionAppliedFor = Array.isArray(languagesData.positionAppliedFor)
      ? languagesData.positionAppliedFor
      : [languagesData.positionAppliedFor]
  }
  return positionAppliedFor
}

const normalizeValue = (primary: any, fallback?: any) => {
  if (primary !== undefined && primary !== null && String(primary).trim() !== '') return primary
  if (fallback !== undefined && fallback !== null && String(fallback).trim() !== '') return fallback
  return ''
}

export const mapApiCandidate = (candidate: any): Candidate => {
  if (!candidate) {
    throw new Error('Candidate data is missing')
  }

  const languagesData = parseLanguagesData(candidate)
  const formDataDiri = parseFormDataDiri(candidate.formDataDiri)
  const positionAppliedFor = parsePositionAppliedFor(candidate, languagesData)
  const divisionList = getCandidateDivisions(candidate)
  const primaryDivision = divisionList.length > 0 ? divisionList[0] : (candidate.user?.division || null)

  const formFullName = formDataDiri?.fullName?.trim() || ''
  const [formFirstName, ...formLastParts] = formFullName ? formFullName.split(' ') : ['']
  const formLastName = formLastParts.join(' ')

  const firstName = candidate.user?.firstName || formFirstName || ''
  const lastName = candidate.user?.lastName || formLastName || ''

  const height = normalizeValue(
    candidate.height !== undefined && candidate.height !== null ? String(candidate.height) : '',
    formDataDiri?.height
  )
  const weight = normalizeValue(
    candidate.weight !== undefined && candidate.weight !== null ? String(candidate.weight) : '',
    formDataDiri?.weight
  )

  const drivingLicense = normalizeDrivingLicense(candidate.drivingLicense, formDataDiri)
  const yearsOfExperienceValue = getCandidateYearsOfExperience(candidate)

  return {
    id: candidate.id,
    userId: candidate.userId,
    user: {
      id: candidate.user?.id || candidate.userId,
      email: candidate.user?.email || formDataDiri?.email || '',
      firstName,
      lastName,
      role: { id: '1', name: 'CANDIDATE', permissions: [] },
      isActive: true,
      createdAt: candidate.createdAt || new Date().toISOString(),
      updatedAt: candidate.updatedAt || new Date().toISOString(),
      division: primaryDivision || null,
    },
    personalInfo: {
      firstName,
      lastName,
      dateOfBirth: normalizeValue(
        candidate.dateOfBirth ? new Date(candidate.dateOfBirth).toISOString().split('T')[0] : '',
        formDataDiri?.dateOfBirth
      ),
      gender: normalizeValue(candidate.gender, formDataDiri?.gender),
      nationality: normalizeValue(candidate.nationality, formDataDiri?.nationality),
      maritalStatus: normalizeValue(candidate.maritalStatus, formDataDiri?.maritalStatus),
    },
    contactInfo: {
      email: normalizeValue(candidate.user?.email, formDataDiri?.email),
      phone: normalizeValue(candidate.user?.phoneNumber || candidate.phoneNumber, formDataDiri?.phoneNumber),
      address: normalizeValue(candidate.currentAddress, formDataDiri?.currentAddress),
      city: candidate.city || '',
      state: candidate.state || '',
      country: candidate.country || '',
      zipCode: candidate.zipCode || '',
    },
    professionalInfo: {
      currentPosition: normalizeValue(candidate.currentJobTitle || candidate.currentPosition, formDataDiri?.currentPosition),
      currentCompany: normalizeValue(candidate.currentCompany, formDataDiri?.currentCompany),
      experience: yearsOfExperienceValue,
      skills: candidate.skills || formDataDiri?.skills || [],
      education: candidate.educations || formDataDiri?.education || [],
      workHistory: candidate.workExperiences || formDataDiri?.workExperience || [],
      certifications: candidate.certifications || [],
    },
    applicationInfo: {
      appliedDate: candidate.createdAt || new Date().toISOString(),
      source: candidate.source || 'manual',
      status: candidate.status || 'new',
      notes: candidate.notes || '',
    },
    status: candidate.status || 'new',
    source: candidate.source || 'manual',
    notes: candidate.notes || '',
    files: mapDocumentsToFiles(candidate.documents || []),
    createdAt: candidate.createdAt || new Date().toISOString(),
    updatedAt: candidate.updatedAt || new Date().toISOString(),
    // Custom fields used by UI
    division: divisionList,
    positionAppliedFor,
    formDataDiri,
    // Additional fields for editing/viewing
    placeOfBirth: normalizeValue(candidate.placeOfBirth, formDataDiri?.placeOfBirth),
    ethnicity: normalizeValue(candidate.ethnicity, formDataDiri?.ethnicity),
    healthStatus: normalizeValue(candidate.healthStatus, formDataDiri?.healthStatus),
    idNumber: normalizeValue(candidate.nationalId, formDataDiri?.idNumber),
    taxNumber: normalizeValue(candidate.npwpNumber, formDataDiri?.taxNumber),
    bpjsNumber: normalizeValue(candidate.bpjsHealthNumber, formDataDiri?.bpjsNumber),
    bloodType: normalizeValue(candidate.bloodType, formDataDiri?.bloodType),
    height,
    weight,
    permanentAddress: normalizeValue(candidate.permanentAddress, formDataDiri?.permanentAddress),
    drivingLicense,
    yearsOfExperience: (() => {
      const raw = candidate.yearsOfExperience ?? languagesData?.yearsOfExperience
      if (raw === undefined || raw === null || String(raw).trim() === '') return ''
      return String(yearsOfExperienceValue)
    })(),
    languages: languagesData ?? (typeof candidate.languages === 'object' ? candidate.languages : null),
  }
}

export default function CandidatesPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const backendRole = (user as any)?.role?.name || (user as any)?.role || 'TA_TEAM'
  const roleName = mapEnumToRole(backendRole)
  const autoViewHandledRef = useRef(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | 'all'>('all')
  const [experienceFilter, setExperienceFilter] = useState<string>('all')
  const [skillsFilter, setSkillsFilter] = useState<string>('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(50)
  const [menuAccess, setMenuAccess] = useState<Record<string, any>>({})
  const [menuAccessLoading, setMenuAccessLoading] = useState(true)
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null)

  useModalEscape(showLinkModal, () => setShowLinkModal(false))

  // Load candidates from API
  const loadCandidates = async () => {
    try {
      const limit = 100
      const maxPages = 100
      let page = 1
      let hasMore = true
      const allCandidatesData: any[] = []

      while (hasMore && page <= maxPages) {
        const response = await CandidatesAPI.getAll({ search: searchTerm }, { page, limit })
        const pageData = response.data || []
        allCandidatesData.push(...pageData)

        const totalPages = response.pagination?.totalPages
        if (typeof totalPages === 'number') {
          hasMore = page < totalPages
        } else {
          hasMore = pageData.length === limit
        }
        page += 1
      }

      const mappedCandidates = allCandidatesData.map((candidate: any) => mapApiCandidate(candidate))
      setCandidates(mappedCandidates)
    } catch (error: any) {
      console.error('Error loading candidates:', error)
      // Fallback to localStorage if API fails (only in browser)
      if (typeof window !== 'undefined') {
        try {
          const savedCandidates = localStorage.getItem('candidates')
          if (savedCandidates) {
            const parsedCandidates = JSON.parse(savedCandidates)
            setCandidates(parsedCandidates)
          }
        } catch (e) {
          console.warn('Could not load candidates from localStorage:', e)
        }
      }
    }
  }

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      loadCandidates()
    }
  }, [isAuthenticated, isLoading])

  // Deep-link: /candidates?view=<id> opens View Candidate modal
  useEffect(() => {
    if (!isAuthenticated || isLoading) return
    if (autoViewHandledRef.current) return
    if (typeof window === 'undefined') return
    const viewId = new URLSearchParams(window.location.search).get('view')
    if (!viewId) return
    const found = candidates.find((c) => c.id === viewId)
    if (!found) return
    autoViewHandledRef.current = true
    handleViewCandidate(found)
  }, [isAuthenticated, isLoading, candidates])

  // Reload candidates when search term changes (debounced)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return
    const timer = setTimeout(() => {
      loadCandidates()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, isAuthenticated, isLoading])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    let isMounted = true
    const loadMenuAccess = async () => {
      if (!isAuthenticated || isLoading || !isMounted) return
      try {
        const access = await MenuAccessAPI.get()
        if (isMounted) {
          setMenuAccess(access || {})
        }
      } catch (error) {
        console.error('Error loading menu access:', error)
        if (isMounted) {
          setMenuAccess({})
        }
      } finally {
        if (isMounted) {
          setMenuAccessLoading(false)
        }
      }
    }

    if (isAuthenticated && !isLoading) {
      loadMenuAccess()
    } else {
      setMenuAccess({})
      setMenuAccessLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, isLoading])

  const allSkillOptions = useMemo(() => {
    const skillSet = new Set<string>()
    candidates.forEach(c => {
      getCandidateSkills(c).forEach(s => {
        const trimmed = s.trim()
        if (trimmed) skillSet.add(trimmed)
      })
    })
    return Array.from(skillSet).sort((a, b) => a.localeCompare(b))
  }, [candidates])

  const filteredCandidates = useMemo(
    () =>
      candidates
        .filter(candidate => {
          const matchesSearch = matchesTokenizedSearch(searchTerm, [
            candidate.personalInfo.firstName,
            candidate.personalInfo.lastName,
            `${candidate.personalInfo.firstName} ${candidate.personalInfo.lastName}`,
            candidate.contactInfo.email,
          ])

          const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter

          const years = candidate.professionalInfo.experience ?? 0
          const matchesExperience =
            experienceFilter === 'all' ||
            (experienceFilter === '0-2' && years >= 0 && years <= 2) ||
            (experienceFilter === '3-5' && years >= 3 && years <= 5) ||
            (experienceFilter === '6-10' && years >= 6 && years <= 10) ||
            (experienceFilter === '10+' && years > 10)

          const matchesSkill =
            skillsFilter === 'all' ||
            getCandidateSkills(candidate).some(
              s => s.trim().toLowerCase() === skillsFilter.toLowerCase()
            )

          return matchesSearch && matchesStatus && matchesExperience && matchesSkill
        })
        .sort((a, b) => {
          const nameA = `${a.personalInfo.firstName || ''} ${a.personalInfo.lastName || ''}`.trim().toLowerCase()
          const nameB = `${b.personalInfo.firstName || ''} ${b.personalInfo.lastName || ''}`.trim().toLowerCase()
          return nameA.localeCompare(nameB)
        }),
    [candidates, searchTerm, statusFilter, experienceFilter, skillsFilter]
  )

  const listMeta = useMemo(() => {
    const total = filteredCandidates.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    const end = start + pageSize
    return {
      total,
      totalPages,
      safePage,
      pagedRows: filteredCandidates.slice(start, end),
    }
  }, [filteredCandidates, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter, pageSize])

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

  const cfg = menuAccess['/candidates'] || {}
  const visibleRoles: string[] = cfg.visibleRoles && cfg.visibleRoles.length ? cfg.visibleRoles : [
    'SUPER_ADMIN','Management','Head of Division','HRBP','TA_TEAM'
  ]
  
  if (menuAccessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }
  
  if (!visibleRoles.includes(roleName)) {
    router.push('/')
    return null
  }
  const perms = cfg.permissions || { view: visibleRoles, create: ['SUPER_ADMIN','HRBP','TA_TEAM'], edit: ['SUPER_ADMIN','HRBP','TA_TEAM'] }
  const canCreate = (perms.create || []).includes(roleName) || (perms.create || []).includes('*')
  const canEdit = (perms.edit || []).includes(roleName) || (perms.edit || []).includes('*')
  const canGenerateLink = ['SUPER_ADMIN', 'TA_TEAM', 'HRBP'].includes(roleName)

  interface UploadFilesPayload {
    cvFile: File | null
    formDataFile: File | null
    additionalFiles?: File[]
  }

  const handleAddCandidate = async (candidateData: any, files?: UploadFilesPayload) => {
    console.log('New candidate data:', candidateData)
    
    try {
      // Check if email is provided (required field)
      if (!candidateData.email || !candidateData.email.trim()) {
        alert('Email is required to create a candidate')
        return
      }
      
      // Prepare data for API
      const firstName = candidateData.fullName.split(' ')[0] || candidateData.fullName
      const lastName = candidateData.fullName.split(' ').slice(1).join(' ') || ''
      
      // Prepare division - send first element if array, or the value if string
      const divisionArray = Array.isArray(candidateData.division)
        ? candidateData.division.map((div: string) => div.trim()).filter((div: string) => !!div)
        : (typeof candidateData.division === 'string' && candidateData.division.trim()
            ? [candidateData.division.trim()]
            : [])
      const divisionValue = divisionArray.length > 0 ? divisionArray[0] : null
      
      const payload = {
        email: candidateData.email.trim(),
        firstName: firstName,
        lastName: lastName,
        phoneNumber: candidateData.phone || null,
        placeOfBirth: candidateData.placeOfBirth || null,
        dateOfBirth: candidateData.dateOfBirth || null,
        gender: candidateData.gender || null,
        maritalStatus: candidateData.maritalStatus || null,
        currentAddress: candidateData.currentAddress || null,
        permanentAddress: candidateData.permanentAddress || null,
        position: candidateData.position || null,
        skills: candidateData.skills || [],
        drivingLicense: candidateData.drivingLicense || [],
        division: divisionValue,
        divisionList: divisionArray,
        positionAppliedFor: Array.isArray(candidateData.positionAppliedFor) ? candidateData.positionAppliedFor : (candidateData.positionAppliedFor ? [candidateData.positionAppliedFor] : []),
        yearsOfExperience:
          candidateData.yearsOfExperience !== undefined &&
          candidateData.yearsOfExperience !== null &&
          String(candidateData.yearsOfExperience).trim() !== ''
            ? candidateData.yearsOfExperience
            : null,
        height: candidateData.height || null,
        weight: candidateData.weight || null,
        taxNumber: candidateData.taxNumber || null,
        bpjsNumber: candidateData.bpjsNumber || null,
        bloodType: candidateData.bloodType || null,
        idNumber: candidateData.idNumber || null,
        ethnicity: candidateData.ethnicity || null,
        healthStatus: candidateData.healthStatus || null,
      }
      
      console.log('CREATE CANDIDATE - Calling CandidatesAPI.create with payload:', JSON.stringify(payload, null, 2))
      
      // Create candidate via API
      const response = await CandidatesAPI.create(payload)
      
      console.log('API response:', response)
      
      if (response.success && response.data) {
        const candidate = response.data
        
        console.log('CREATE CANDIDATE - Received candidate data from API:', JSON.stringify(candidate, null, 2))
        console.log('CREATE CANDIDATE - positionAppliedFor:', candidate.positionAppliedFor)
        console.log('CREATE CANDIDATE - division:', candidate.user?.division)
        console.log('CREATE CANDIDATE - languages:', candidate.languages)
        
        const newCandidate = mapApiCandidate(candidate)
        newCandidate.applicationInfo = {
          appliedDate: candidate.createdAt || new Date().toISOString(),
          source: 'Manual Entry',
          status: 'new' as CandidateStatus,
          notes: `Added via Add Candidate form. Additional info: Place of Birth: ${candidateData.placeOfBirth || 'N/A'}, Marital Status: ${candidateData.maritalStatus || 'N/A'}, Health Status: ${candidateData.healthStatus || 'N/A'}`
        }
        newCandidate.status = 'new'
        newCandidate.source = 'Manual Entry'
        
        console.log('CREATE CANDIDATE - Mapped newCandidate:', JSON.stringify({
          id: newCandidate.id,
          division: newCandidate.division,
          positionAppliedFor: newCandidate.positionAppliedFor,
          ethnicity: (newCandidate as any).ethnicity,
          healthStatus: (newCandidate as any).healthStatus
        }, null, 2))

        const cvFile: File | null = files?.cvFile ?? candidateData.cvFile ?? null
        const additionalFiles: File[] = files?.additionalFiles ?? candidateData.additionalFiles ?? []
        
        if (cvFile instanceof File) {
          try {
            console.log('CREATE CANDIDATE - Uploading CV file...')
            await CandidatesAPI.uploadDocument(candidate.id, cvFile, 'RESUME')
            console.log('CREATE CANDIDATE - CV upload successful')
          } catch (uploadError: any) {
            console.error('Error uploading candidate CV:', uploadError)
            const uploadMessage = uploadError?.response?.data?.message || uploadError?.message || 'Unknown error'
            alert(`Candidate created, but uploading CV failed: ${uploadMessage}`)
          }
        }

        // Upload additional files
        if (additionalFiles && additionalFiles.length > 0) {
          console.log(`CREATE CANDIDATE - Uploading ${additionalFiles.length} additional file(s)...`)
          const uploadResults: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] }
          
          for (const file of additionalFiles) {
            try {
              await CandidatesAPI.uploadDocument(candidate.id, file, 'OTHER')
              uploadResults.success++
              console.log(`CREATE CANDIDATE - Additional file "${file.name}" upload successful`)
            } catch (uploadError: any) {
              uploadResults.failed++
              console.error(`Error uploading additional file "${file.name}":`, uploadError)
              const uploadMessage = uploadError?.response?.data?.message || uploadError?.message || 'Unknown error'
              uploadResults.errors.push(`${file.name}: ${uploadMessage}`)
              
              // Check if it's a rate limit error
              if (uploadError?.response?.status === 429) {
                console.error('Rate limit hit during file upload')
              }
            }
          }
          
          // Show summary of upload results
          if (uploadResults.failed > 0) {
            const errorSummary = uploadResults.errors.join('\n')
            alert(`Candidate created. ${uploadResults.success} file(s) uploaded successfully, ${uploadResults.failed} failed:\n\n${errorSummary}`)
          } else if (uploadResults.success > 0) {
            console.log(`CREATE CANDIDATE - All ${uploadResults.success} additional file(s) uploaded successfully`)
          }
        }

        // Reload candidates to ensure consistency (this will overwrite the manually created one)
        await loadCandidates()
        
        // Close modal
        setIsAddModalOpen(false)
        
        alert('Candidate created successfully!')
        return candidate
      } else {
        alert('Failed to create candidate: ' + (response.message || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Error creating candidate:', error)
      alert('Error creating candidate: ' + (error.response?.data?.message || error.message || 'Unknown error'))
    }
  }

  const handleViewCandidate = async (candidate: Candidate) => {
    try {
      // Fetch fresh candidate data from API to ensure we have all fields
      const response = await CandidatesAPI.getById(candidate.id)
      console.log('handleViewCandidate - API response:', response)
      console.log('handleViewCandidate - Documents in response:', response?.documents?.length, response?.documents)
      if (response) {
        const mappedCandidate = mapApiCandidate(response)
        console.log('handleViewCandidate - Mapped candidate files:', mappedCandidate.files?.length, mappedCandidate.files)
        setSelectedCandidate(mappedCandidate)
        setIsViewModalOpen(true)
      } else {
        // Fallback to using the candidate from list
        setSelectedCandidate(candidate)
        setIsViewModalOpen(true)
      }
    } catch (error: any) {
      console.error('Error fetching candidate details:', error)
      // Fallback to using the candidate from list
      setSelectedCandidate(candidate)
      setIsViewModalOpen(true)
    }
  }

  const handleEditCandidate = async (candidate: Candidate) => {
    console.log('========== handleEditCandidate CALLED ==========')
    console.log('Opening edit modal for candidate:', candidate.id)
    try {
      // Fetch fresh candidate data from API to ensure we have all fields
      const response = await CandidatesAPI.getById(candidate.id)
      if (response) {
        const mappedCandidate = mapApiCandidate(response)
        setSelectedCandidate(mappedCandidate)
        setIsEditModalOpen(true)
      } else {
        // Fallback to using the candidate from list
        setSelectedCandidate(candidate)
        setIsEditModalOpen(true)
      }
    } catch (error: any) {
      console.error('Error fetching candidate details:', error)
      // Fallback to using the candidate from list
      setSelectedCandidate(candidate)
      setIsEditModalOpen(true)
    }
  }

  const handleUpdateCandidate = async (candidateData: any, files?: UploadFilesPayload) => {
    console.log('========== handleUpdateCandidate START ==========')
    console.log('handleUpdateCandidate FUNCTION CALLED!')
    console.log('handleUpdateCandidate called with:', candidateData)
    console.log('selectedCandidate:', selectedCandidate)
    console.log('selectedCandidate?.id:', selectedCandidate?.id)
    
    if (!selectedCandidate) {
      console.error('handleUpdateCandidate: selectedCandidate is null, cannot update')
      alert('Error: No candidate selected for update')
      return
    }
    
    console.log('selectedCandidate is valid, proceeding with update...')

    console.log('Updating candidate data:', candidateData)
    try {
      const firstName = candidateData.fullName.split(' ')[0] || candidateData.fullName
      const lastName = candidateData.fullName.split(' ').slice(1).join(' ') || ''
      
      console.log('Building payload...')

      // Send all fields - convert empty strings to null, but always send the fields
      const payload: any = {
        email: candidateData.email,
        firstName,
        lastName,
        phoneNumber: candidateData.phone || null,
        placeOfBirth: candidateData.placeOfBirth || null,
        dateOfBirth: candidateData.dateOfBirth || null,
        gender: candidateData.gender || null,
        maritalStatus: candidateData.maritalStatus || null,
        currentAddress: candidateData.currentAddress || null,
        permanentAddress: candidateData.permanentAddress || null,
        position: candidateData.position || null,
        skills: candidateData.skills || [],
        drivingLicense: candidateData.drivingLicense || '',
        divisionList: Array.isArray(candidateData.division)
          ? candidateData.division.map((div: string) => div.trim()).filter((div: string) => !!div)
          : (typeof candidateData.division === 'string' && candidateData.division.trim() ? [candidateData.division.trim()] : []),
        positionAppliedFor: candidateData.positionAppliedFor || [],
        yearsOfExperience:
          candidateData.yearsOfExperience !== undefined &&
          candidateData.yearsOfExperience !== null &&
          String(candidateData.yearsOfExperience).trim() !== ''
            ? candidateData.yearsOfExperience
            : null,
        height: candidateData.height || null,
        weight: candidateData.weight || null,
        taxNumber: candidateData.taxNumber || null,
        bpjsNumber: candidateData.bpjsNumber || null,
        bloodType: candidateData.bloodType || null,
        idNumber: candidateData.idNumber || null,
        ethnicity: candidateData.ethnicity || null,
        healthStatus: candidateData.healthStatus || null,
      }
      // After computing divisionList, ensure primary division is included
      payload.division = payload.divisionList && payload.divisionList.length > 0 ? payload.divisionList[0] : null
      
      console.log('Update payload being sent:', JSON.stringify(payload, null, 2))
      console.log('Calling CandidatesAPI.update with id:', selectedCandidate.id)

      let res
      try {
        console.log('About to call CandidatesAPI.update...')
        res = await CandidatesAPI.update(selectedCandidate.id, payload)
        console.log('UPDATE CANDIDATE - API response received:', JSON.stringify(res, null, 2))
      } catch (apiError: any) {
        console.error('CandidatesAPI.update threw an error:', apiError)
        console.error('Error details:', {
          message: apiError.message,
          response: apiError.response?.data,
          status: apiError.response?.status,
          stack: apiError.stack
        })
        throw apiError // Re-throw to be caught by outer catch
      }
      
      if (res && res.success) {
        console.log('UPDATE CANDIDATE - Update successful, reloading candidates...')
 
        const cvFile: File | null = files?.cvFile ?? candidateData.cvFile ?? null
        const additionalFiles: File[] = files?.additionalFiles ?? candidateData.additionalFiles ?? []
        let latestCandidateData = res.data || null
        let mappedUpdatedCandidate: Candidate | null = null

        // Get count of existing OTHER documents before uploading new ones
        const existingOtherDocsCount = latestCandidateData?.documents?.filter((d: any) => d.documentType === 'OTHER')?.length || 0
        console.log(`UPDATE CANDIDATE - Existing OTHER documents count: ${existingOtherDocsCount}`)

        if (cvFile instanceof File) {
          try {
            console.log('UPDATE CANDIDATE - Uploading updated CV file...')
            await CandidatesAPI.uploadDocument(selectedCandidate.id, cvFile, 'RESUME')
            console.log('UPDATE CANDIDATE - CV upload successful')
            latestCandidateData = await CandidatesAPI.getById(selectedCandidate.id)
          } catch (uploadError: any) {
            console.error('Error uploading updated CV:', uploadError)
            const uploadMessage = uploadError?.response?.data?.message || uploadError?.message || 'Unknown error'
            alert(`Candidate updated, but uploading CV failed: ${uploadMessage}`)
          }
        }

        // Upload additional files
        if (additionalFiles && additionalFiles.length > 0) {
          console.log(`[FRONTEND] ========== STARTING ADDITIONAL FILES UPLOAD ==========`)
          console.log(`[FRONTEND] UPDATE CANDIDATE - Uploading ${additionalFiles.length} additional file(s)...`)
          console.log(`[FRONTEND] Existing OTHER documents count: ${existingOtherDocsCount}`)
          const uploadResults: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] }
          
          // Upload files sequentially with a small delay to avoid race conditions
          for (let i = 0; i < additionalFiles.length; i++) {
            const file = additionalFiles[i]
            try {
              console.log(`UPDATE CANDIDATE - Uploading file ${i + 1}/${additionalFiles.length}: "${file.name}"`)
              const uploadResponse = await CandidatesAPI.uploadDocument(selectedCandidate.id, file, 'OTHER')
              uploadResults.success++
              console.log(`UPDATE CANDIDATE - Additional file "${file.name}" upload successful`, uploadResponse)
              
              // Add a small delay between uploads (except for the last one) to avoid race conditions
              if (i < additionalFiles.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
              }
            } catch (uploadError: any) {
              uploadResults.failed++
              console.error(`Error uploading additional file "${file.name}":`, uploadError)
              const uploadMessage = uploadError?.response?.data?.message || uploadError?.message || 'Unknown error'
              uploadResults.errors.push(`${file.name}: ${uploadMessage}`)
              
              // Check if it's a rate limit error
              if (uploadError?.response?.status === 429) {
                console.error('Rate limit hit during file upload')
              }
            }
          }
          
          // Wait a bit before refreshing to ensure all database writes are complete
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Refresh candidate data after uploading additional files
          console.log('UPDATE CANDIDATE - Refreshing candidate data to verify uploads...')
          latestCandidateData = await CandidatesAPI.getById(selectedCandidate.id)
          
          // Verify the uploads
          const uploadedDocs = latestCandidateData?.documents?.filter((d: any) => d.documentType === 'OTHER') || []
          console.log(`UPDATE CANDIDATE - Verification: Found ${uploadedDocs.length} OTHER documents in database`)
          uploadedDocs.forEach((doc: any, idx: number) => {
            console.log(`  ${idx + 1}. ${doc.originalName} (${doc.fileName})`)
          })
          
          // Show summary of upload results
          if (uploadResults.failed > 0) {
            const errorSummary = uploadResults.errors.join('\n')
            alert(`Candidate updated. ${uploadResults.success} file(s) uploaded successfully, ${uploadResults.failed} failed:\n\n${errorSummary}`)
          } else if (uploadResults.success > 0) {
            console.log(`UPDATE CANDIDATE - All ${uploadResults.success} additional file(s) uploaded successfully`)
            const expectedCount = uploadResults.success + existingOtherDocsCount
            if (uploadedDocs.length !== expectedCount) {
              console.warn(`UPDATE CANDIDATE - WARNING: Expected ${expectedCount} OTHER documents (${existingOtherDocsCount} existing + ${uploadResults.success} new), but found ${uploadedDocs.length}`)
            } else {
              console.log(`UPDATE CANDIDATE - Verification passed: ${uploadedDocs.length} OTHER documents found as expected`)
            }
          }
        }

        // Reload candidates list to get fresh data from database
        await loadCandidates()
 
        // Also refresh the selected candidate with updated data
        if (latestCandidateData) {
          const response = latestCandidateData
          console.log('UPDATE CANDIDATE - Response data:', JSON.stringify({
            id: response.id,
            division: response.user?.division,
            positionAppliedFor: response.positionAppliedFor,
            languages: response.languages,
            ethnicity: response.ethnicity,
            healthStatus: response.healthStatus
          }, null, 2))
          mappedUpdatedCandidate = mapApiCandidate(response)
          setSelectedCandidate(mappedUpdatedCandidate)
        }

        if (!mappedUpdatedCandidate && res.data) {
          mappedUpdatedCandidate = mapApiCandidate(res.data)
          setSelectedCandidate(mappedUpdatedCandidate)
        }
        
        alert('Candidate updated successfully!')
        setIsEditModalOpen(false)
        setSelectedCandidate(null)
        return mappedUpdatedCandidate
      } else {
        alert('Failed to update candidate')
      }
    } catch (e: any) {
      console.error('Error updating candidate:', e)
      alert('Error updating candidate: ' + (e.response?.data?.message || e.message || 'Unknown error'))
    }
  }

  const handleDeleteCandidate = async (candidateId: string) => {
    const confirmed = window.confirm(
      'Delete this candidate? They will be removed from all lists but kept in the database for audit purposes.'
    )
    if (!confirmed) return

    try {
      setDeletingCandidateId(candidateId)
      await CandidatesAPI.delete(candidateId)

      if (selectedCandidate?.id === candidateId) {
        setIsViewModalOpen(false)
        setIsEditModalOpen(false)
        setSelectedCandidate(null)
      }

      setCandidates((prev) => prev.filter((candidate) => candidate.id !== candidateId))
    } catch (error: any) {
      console.error('Error deleting candidate:', error)
      alert(error.response?.data?.message || error.message || 'Failed to delete candidate. Please try again.')
    } finally {
      setDeletingCandidateId(null)
    }
  }

  const handleGenerateLink = async (candidateId: string) => {
    try {
      const response = await CandidatesAPI.createFormLink(candidateId)
      if (response.success && response.data) {
        const linkData = response.data
        const linkUrl = linkData.link

        saveCandidateLink({
          id: linkData.id,
          candidateId: linkData.candidateId,
          token: linkData.token,
          link: linkUrl,
          createdAt: linkData.createdAt,
          expiresAt: linkData.expiresAt,
          isActive: linkData.isActive,
          submittedAt: linkData.submittedAt || undefined,
        })

        setGeneratedLink(linkUrl)
        setShowLinkModal(true)
      } else {
        alert(response.message || 'Failed to generate form link')
      }
    } catch (error: any) {
      console.error('Error generating form link:', error)
      alert(error.response?.data?.message || error.message || 'Failed to generate form link')
    }
  }

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink)
      alert('Link copied to clipboard!')
    }
  }

  return (
    <Layout>
      <div>
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Candidates</h1>
            <p className="mt-2 text-sm text-gray-700">
              Manage and track all candidate information and applications.
            </p>
          </div>
          <div
            className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex gap-2 justify-end"
            data-tour="candidates-add"
          >
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => canCreate && setIsBulkUploadOpen(true)}
              className={`block rounded-md px-3 py-2 text-center text-sm font-semibold shadow-sm ring-1 ring-inset ${canCreate ? 'text-gray-900 ring-gray-300 hover:bg-gray-50' : 'text-gray-400 ring-gray-200 cursor-not-allowed'}`}
            >
              Bulk Upload
            </button>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => canCreate && setIsAddModalOpen(true)}
              className={`block rounded-md px-3 py-2 text-center text-sm font-semibold text-white shadow-sm ${canCreate ? 'bg-indigo-600 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600' : 'bg-gray-300 cursor-not-allowed'}`}
            >
              <PlusIcon className="h-4 w-4 inline mr-2" />
              Add Candidate
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col gap-3" data-tour="candidates-filters">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  placeholder="Search candidates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select
                className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as CandidateStatus | 'all'); setPage(1) }}
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="screening">Screening</option>
                <option value="interview_scheduled">Interview Scheduled</option>
                <option value="interviewed">Interviewed</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="rejected">Rejected</option>
                <option value="hired">Hired</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Experience filter */}
            <div className="sm:w-52">
              <select
                className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                value={experienceFilter}
                onChange={(e) => { setExperienceFilter(e.target.value); setPage(1) }}
              >
                <option value="all">All Experience</option>
                <option value="0-2">0 – 2 years</option>
                <option value="3-5">3 – 5 years</option>
                <option value="6-10">6 – 10 years</option>
                <option value="10+">10+ years</option>
              </select>
            </div>
            {/* Skills filter */}
            <div className="sm:w-56">
              <select
                className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                value={skillsFilter}
                onChange={(e) => { setSkillsFilter(e.target.value); setPage(1) }}
              >
                <option value="all">All Skills</option>
                {allSkillOptions.map(skill => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </div>
            {(experienceFilter !== 'all' || skillsFilter !== 'all') && (
              <button
                type="button"
                className="text-sm text-indigo-600 hover:text-indigo-800 self-center"
                onClick={() => { setExperienceFilter('all'); setSkillsFilter('all'); setPage(1) }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <label className="text-sm text-gray-600 whitespace-nowrap">Rows per page</label>
            <select
              className="block rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as 10 | 50 | 100)}
            >
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="mt-8 flow-root" data-tour="candidates-lifecycle">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Contact
                      </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Division
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Position Applied For
                        </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Source
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Applied
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {listMeta.pagedRows.map((candidate) => {
                      console.log('Candidate data:', candidate)
                      console.log('Position Applied For:', (candidate as any).positionAppliedFor)
                      console.log('Professional Info:', candidate.professionalInfo)
                      return (
                      <tr key={candidate.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                                <span className="text-sm font-medium text-white">
                                  {candidate.personalInfo.firstName[0]}{candidate.personalInfo.lastName[0]}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="font-medium text-gray-900">
                                {candidate.personalInfo.firstName} {candidate.personalInfo.lastName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <div>{candidate.contactInfo.email}</div>
                          <div>{candidate.contactInfo.phone}</div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {(() => {
                            // Try multiple sources for division
                            const divisionArray = (candidate as any).division || [];
                            const divisionString = candidate.user?.division;
                            const divisions = Array.isArray(divisionArray) && divisionArray.length > 0 
                              ? divisionArray 
                              : (divisionString ? [divisionString] : []);
                            
                            if (divisions.length > 0) {
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {divisions.map((div: string, idx: number) => (
                                    <span key={idx} className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                                      {div}
                                    </span>
                                  ))}
                                </div>
                              );
                            }
                            return <span className="text-gray-400">Not specified</span>;
                          })()}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {(() => {
                            // Try multiple sources for positionAppliedFor
                            const positionArray = (candidate as any).positionAppliedFor || [];
                            const positions = Array.isArray(positionArray) && positionArray.length > 0 
                              ? positionArray 
                              : [];
                            
                            if (positions.length > 0) {
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {positions.map((pos: string, idx: number) => (
                                    <span key={idx} className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                                      {pos}
                                    </span>
                                  ))}
                                </div>
                              );
                            }
                            // Fallback to currentPosition if available
                            if (candidate.professionalInfo.currentPosition) {
                              return (
                                <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                                  {candidate.professionalInfo.currentPosition}
                                </span>
                              );
                            }
                            return <span className="text-gray-400">Not specified</span>;
                          })()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColors[candidate.status]}`}>
                            {candidate.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {candidate.source}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {new Date(candidate.createdAt).toLocaleDateString()}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end gap-2">
                            {canGenerateLink && (
                              <button 
                                onClick={() => handleGenerateLink(candidate.id)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Generate Form Link"
                              >
                                <LinkIcon className="h-4 w-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleViewCandidate(candidate)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              View
                            </button>
                            <button 
                              disabled={!canEdit}
                              onClick={() => canEdit && handleEditCandidate(candidate)}
                              className={` ${canEdit ? 'text-green-600 hover:text-green-900' : 'text-gray-300 cursor-not-allowed'}`}
                            >
                              Edit
                            </button>
                            <button 
                              disabled={!canEdit || deletingCandidateId === candidate.id}
                              onClick={() => canEdit && handleDeleteCandidate(candidate.id)}
                              className={`${canEdit && deletingCandidateId !== candidate.id ? 'text-red-600 hover:text-red-900' : 'text-gray-300 cursor-not-allowed'}`}
                            >
                              {deletingCandidateId === candidate.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {listMeta.total === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">No candidates found matching your criteria.</div>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <span>
            {listMeta.total === 0
              ? 'Showing 0 of 0'
              : `Showing ${(listMeta.safePage - 1) * pageSize + 1}-${Math.min(listMeta.safePage * pageSize, listMeta.total)} of ${listMeta.total}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={listMeta.safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {listMeta.safePage} / {listMeta.totalPages}
            </span>
            <button
              type="button"
              disabled={listMeta.safePage >= listMeta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

        {/* Add Candidate Modal */}
        <EnhancedAddCandidateModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleAddCandidate}
        />

        {/* View Candidate Modal */}
        <ViewCandidateModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          candidate={selectedCandidate}
        />

        {/* Edit Candidate Modal */}
        {(() => {
          console.log('RENDERING EditCandidateModal component:', {
            isEditModalOpen,
            hasSelectedCandidate: !!selectedCandidate,
            selectedCandidateId: selectedCandidate?.id,
            handleUpdateCandidate: typeof handleUpdateCandidate
          })
          return (
            <EditCandidateModal
              isOpen={isEditModalOpen}
              onClose={() => {
                console.log('EditCandidateModal onClose called')
                setIsEditModalOpen(false)
              }}
              onSave={(data) => {
                console.log('EditCandidateModal onSave prop called with:', data)
                console.log('handleUpdateCandidate function:', handleUpdateCandidate)
                handleUpdateCandidate(data)
              }}
              candidate={selectedCandidate}
            />
          )
        })()}

        {/* Generated Link Modal */}
        {showLinkModal && generatedLink && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowLinkModal(false)}></div>
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <LinkIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-base font-semibold leading-6 text-gray-900">Form Link Generated</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">This link will be valid for 7 days. Share it with the candidate.</p>
                    </div>
                    <div className="mt-4">
                      <div className="rounded-md bg-gray-50 p-3">
                        <p className="text-sm text-gray-800 break-all">{generatedLink}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:col-start-2"
                  >
                    Copy Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLinkModal(false)
                      setGeneratedLink(null)
                    }}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <BulkUploadModal
          isOpen={isBulkUploadOpen}
          title="Bulk Upload Candidates"
          templateName="candidates-upload-template"
          onClose={() => setIsBulkUploadOpen(false)}
          onDownloadTemplate={(format) => CandidatesAPI.downloadTemplate(format)}
          onUpload={(file) => CandidatesAPI.bulkUpload(file)}
          onUploaded={async () => {
            await loadCandidates()
          }}
        />
      </div>
    </Layout>
  )
}
