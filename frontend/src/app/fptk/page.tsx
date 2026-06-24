'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useModalEscape } from '@/hooks/useModalEscape'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import CreateJobPostingModal from '@/components/CreateJobPostingModal'
import ViewJobPostingModal from '@/components/ViewJobPostingModal'
import EditJobPostingModal from '@/components/EditJobPostingModal'
import { FPTK, FPTKStatus, JobType } from '@/types'
const mapEmploymentType = (value?: string): JobType => {
  const normalized = (value || '').toLowerCase()
  if (normalized === 'contract' || normalized === 'kontrak') return 'contract'
  if (normalized === 'part-time') return 'part-time'
  if (normalized === 'internship') return 'internship'
  if (normalized === 'full time employee' || normalized === 'full-time employee') return 'full-time'
  return 'full-time'
}

import { PlusIcon, MagnifyingGlassIcon, BriefcaseIcon, EyeIcon, PencilIcon, ArrowUpTrayIcon, DocumentArrowDownIcon, XMarkIcon, DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  parseFPTKExcelFile,
  generateFPTKTemplate,
  getPositionNameForFailedExport,
  FPTKUploadResult,
} from '@/utils/fptkExcelParser'
import { FPTKAPI, MasterOfficeLocationAPI, MenuAccessAPI } from '@/lib/api'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'

const DEFAULT_CURRENT_STATUS = 'Pending FKTK'

const mapEnumToRole = (role: string): string => {
  if (!role) return role
  const roleMap: Record<string, string> = {
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
  return roleMap[role] || role
}

const CURRENT_STATUS_OPTIONS = [
  'Open',
  'Pending FKTK',
  'Re-Open',
  'Cancel',
  'Internal Movement',
  'Close',
] as const

const mapUiStatusToDbStatus = (value?: string, fallback?: string) => {
  if (!value) {
    return fallback || 'DRAFT'
  }

  const normalized = value.trim().toLowerCase()
  const lookup: Record<string, string> = {
    draft: 'DRAFT',
    active: 'OPEN',
    open: 'OPEN',
    paused: 'DRAFT',
    closed: 'FILLED',
    filled: 'FILLED',
    cancelled: 'CANCELLED',
    approved: 'APPROVED',
    expired: 'EXPIRED',
    'partially filled': 'PARTIALLY_FILLED',
    'partially_filled': 'PARTIALLY_FILLED',
    're-open': 'OPEN',
    'pending fktk': 'DRAFT',
    cancel: 'CANCELLED',
    'internal movement': 'DRAFT',
    close: 'FILLED',
  }

  return lookup[normalized] || fallback || 'DRAFT'
}

const mapDbStatusToUiStatus = (value?: string): FPTKStatus => {
  const normalized = (value || 'DRAFT').toUpperCase()
  switch (normalized) {
    case 'APPROVED':
      return 'approved'
    case 'OPEN':
      return 'open'
    case 'PARTIALLY_FILLED':
      return 'partially_filled'
    case 'FILLED':
      return 'filled'
    case 'CANCELLED':
      return 'cancelled'
    case 'EXPIRED':
      return 'expired'
    default:
      return 'draft'
  }
}

const APPLICATION_STATUS_UI_LABELS: Record<string, string> = {
  DRAFT: 'Applied',
  SUBMITTED: 'Applied',
  SCREENING: 'Shortlisted',
  PSYCHOMETRIC_TEST: 'Under Review',
  TECHNICAL_TEST: 'Assessment',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_COMPLETED: 'Interviewed',
  DOCUMENT_VERIFICATION: 'Document Verification',
  OFFER_PROPOSED: 'Offering Creation',
  OFFER_APPROVED: 'Pending Feedback',
  OFFER_SENT: 'Offer Sent',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_REJECTED: 'Offer Rejected',
  MEDICAL_CHECKUP_SCHEDULED: 'Medical Checkup Scheduled',
  MEDICAL_CHECKUP_COMPLETED: 'MCU',
  CONTRACT_SENT: 'Contract Sent',
  CONTRACT_SIGNED: 'Contract Signed',
  ONBOARDING: 'On Boarding',
  HIRED: 'Hired',
  REJECTED: 'Rejected (Failed Interview / Assessment)',
  WITHDRAWN: 'Withdrawn',
  KEEP_IN_VIEW: 'Keep In View',
}

const mapApplicationStatusToUi = (status?: string): string => {
  if (!status) return 'Applied'
  const normalized = status.toString().toUpperCase()
  if (APPLICATION_STATUS_UI_LABELS[normalized]) {
    return APPLICATION_STATUS_UI_LABELS[normalized]
  }
  return normalized
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const parseJsonField = (value: any) => {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  if (typeof value === 'object') return value
  return null
}

export const mapApiFptk = (fptk: any): FPTK => {
  const currentStatus = fptk.currentStatus || DEFAULT_CURRENT_STATUS
  const backendStatus = (fptk.status || 'DRAFT').toUpperCase()
  const uiStatus = mapDbStatusToUiStatus(backendStatus)

  const appliedCandidates = Array.isArray(fptk.applications)
    ? fptk.applications.map((application: any) => {
        const candidate = application?.candidate || {}
        const user = candidate.user || {}
        const formDataDiri = parseJsonField(candidate.formDataDiri)
        const languagesData = parseJsonField(candidate.languages)

        const fullName =
          [user.firstName, user.lastName].filter(Boolean).join(' ') ||
          formDataDiri?.fullName ||
          candidate.fullName ||
          candidate.name ||
          `Candidate ${candidate.id?.slice(0, 6) || ''}`

        const email = user.email || candidate.email || formDataDiri?.email || ''
        const skills = Array.isArray(candidate.skills)
          ? candidate.skills
          : Array.isArray(languagesData?.skills)
            ? languagesData.skills
            : []
        const experience =
          typeof languagesData?.yearsOfExperience === 'number'
            ? languagesData.yearsOfExperience
            : 0

        // Map interviews from backend format to frontend format
        const interviews = Array.isArray(application.interviews)
          ? application.interviews.map((interview: any) => {
              // Get interviewer name: prefer from relation, fallback to stored name
              let interviewerName = ''
              if (interview.interviewer) {
                interviewerName = `${interview.interviewer.firstName || ''} ${interview.interviewer.lastName || ''}`.trim() || interview.interviewer.email || ''
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
          rejectionReason: application.rejectionReason || null,
          blacklisted: candidate.blacklisted || false,
          blacklistReason: candidate.blacklistReason || null,
          source: application.source,
          skills,
          experience,
          yearsOfExperience: experience,
          division: user.division || candidate.division || null,
          interviews, // Include interviews data
        }
      })
    : []

  // Map employment type and also preserve normalized value
  const mappedType = mapEmploymentType(fptk.employmentType)
  const normalizedEmploymentType = (() => {
    const empType = fptk.employmentType?.toString().trim().toLowerCase() || ''
    if (empType === 'kontrak' || empType === 'contract') return 'Contract'
    if (empType === 'probation' || empType === 'full-time' || empType === 'fulltime' || empType === 'full time employee') return 'Full Time Employee'
    if (empType === 'internship') return 'Internship'
    // Map from type if employmentType is not in expected format
    if (mappedType === 'contract') return 'Contract'
    if (mappedType === 'full-time') return 'Full Time Employee'
    if (mappedType === 'internship') return 'Internship'
    return ''
  })()

  return {
    id: fptk.id,
    title: fptk.positionTitle || fptk.position,
    department: fptk.department,
    position: fptk.position || fptk.positionTitle,
    level: fptk.level || fptk.typeGrade,
    location: fptk.location || fptk.area,
    type: mappedType,
    employmentType: normalizedEmploymentType,
    status: uiStatus,
    currentStatus,
    statusEnum: backendStatus,
    description: fptk.jobSpecification || fptk.jobDescription || '',
    requirements: fptk.qualifications ? [fptk.qualifications] : [],
    responsibilities: fptk.responsibilities ? [fptk.responsibilities] : [],
    skills: fptk.requiredSkills || [],
    experience: {
      min: fptk.minExperience || 0,
      max: fptk.minExperience ? fptk.minExperience + 2 : 0
    },
    education: {
      level: fptk.minEducation || 'Any',
      fields: [],
      required: false
    },
    salary: {
      min: fptk.salaryRangeMin ? parseFloat(fptk.salaryRangeMin.toString()) : 0,
      max: fptk.salaryRangeMax ? parseFloat(fptk.salaryRangeMax.toString()) : 0,
      currency: 'IDR',
      period: 'monthly'
    },
    benefits: fptk.benefits ? (typeof fptk.benefits === 'string' ? [fptk.benefits] : fptk.benefits) : [],
    hiringManager: fptk.hiringManager || '',
    recruiter: '',
    priority: fptk.priority === 'P0' ? 'urgent' : fptk.priority === 'P1' ? 'high' : fptk.priority === 'P2' ? 'medium' : 'low',
    deadline: fptk.priorityByMonthYear,
    createdAt: fptk.createdAt,
    updatedAt: fptk.updatedAt,
    pt: fptk.pt,
    noFktk: fptk.noFktk,
    statusFktk: fptk.statusFktk,
    section: fptk.section,
    typeGrade: fptk.typeGrade,
    grade2: fptk.grade2,
    urgentNormal: fptk.priority,
    priorityByMonthYear: fptk.priorityByMonthYear,
    jobSpecification: fptk.jobSpecification,
    criteria: fptk.criteria,
    area: fptk.area,
    areaDetail: fptk.areaDetail,
    additionalOrReplacement: fptk.additionalOrReplacement,
    replacementName: fptk.replacementName,
    resignReason: fptk.resignReason,
    totalRequest: fptk.totalRequest,
    requestDate: fptk.requestDate,
    remark: fptk.remark,
    fptkReceiveDate: (fptk as any).fptkReceiveDate,
    fptkFilePath: (fptk as any).fptkFilePath,
    fptkFileName: (fptk as any).fptkFileName,
    // Map status history to milestones format
    milestones: Array.isArray((fptk as any).statusHistory)
      ? (fptk as any).statusHistory.map((history: any) => ({
          status: history.toStatus,
          startDate: history.startDate,
          endDate: history.endDate,
          updatedAt: history.createdAt,
        }))
      : [],
    appliedCandidates,
    applicationsCount: fptk._count?.applications ?? appliedCandidates.length,
  }
}

const mapAppliedCandidatesForPayload = (candidates?: any[]) => {
  if (!Array.isArray(candidates)) return []

  const mapUiStatusToBackend = (status?: string) => {
    const raw = (status || '').toString().trim()
    if (!raw) return 'SUBMITTED'
    const upper = raw.toUpperCase()
    if (/^[A-Z0-9_]+$/.test(upper)) return upper
    const lookup: Record<string, string> = {
      'applied': 'SUBMITTED',
      'under review': 'SCREENING',
      'shortlisted': 'SCREENING',
      'interview scheduled': 'INTERVIEW_SCHEDULED',
      'interviewed': 'INTERVIEW_COMPLETED',
      'assessment': 'TECHNICAL_TEST',
      'offering creation': 'OFFER_PROPOSED',
      'pending feedback': 'OFFER_APPROVED',
      'document verification': 'DOCUMENT_VERIFICATION',
      'offer sent': 'OFFER_SENT',
      'offer accepted': 'OFFER_ACCEPTED',
      'offer rejected': 'OFFER_REJECTED',
      'mcu': 'MEDICAL_CHECKUP_COMPLETED',
      'medical checkup scheduled': 'MEDICAL_CHECKUP_SCHEDULED',
      'medical checkup completed': 'MEDICAL_CHECKUP_COMPLETED',
      'contract sent': 'CONTRACT_SENT',
      'contract signed': 'CONTRACT_SIGNED',
      'on boarding': 'ONBOARDING',
      'hired': 'HIRED',
      'rejected (failed interview / assessment)': 'REJECTED',
      'rejected': 'REJECTED',
      'withdrawn': 'WITHDRAWN',
      'keep in view': 'KEEP_IN_VIEW',
    }
    return lookup[raw.toLowerCase()] || 'SUBMITTED'
  }

  return candidates
    .map((candidate: any) => {
      if (!candidate) return null
      const rawStatus = candidate.status || candidate.backendStatus || 'Applied'
      const statusFromEnum =
        typeof rawStatus === 'string' && /^[A-Z0-9_]+$/.test(rawStatus.trim()) && rawStatus.length > 1
          ? APPLICATION_STATUS_UI_LABELS[rawStatus.trim() as keyof typeof APPLICATION_STATUS_UI_LABELS] || rawStatus
          : rawStatus
      return {
        id: candidate.candidateId || candidate.id,
        candidateId: candidate.candidateId || candidate.id,
        fullName: candidate.fullName || candidate.name,
        email: candidate.email,
        status: mapUiStatusToBackend(candidate.status || statusFromEnum),
        appliedDate: candidate.appliedDate || candidate.appliedAt || new Date().toISOString(),
        source: candidate.source,
        // Include interview data if it exists
        interviews: candidate.interviews || [],
        rejectedDate: candidate.rejectedDate
          ? new Date(candidate.rejectedDate).toISOString()
          : candidate.rejectedAt
            ? new Date(candidate.rejectedAt).toISOString()
            : null,
        withdrawDate: candidate.withdrawDate
          ? new Date(candidate.withdrawDate).toISOString()
          : candidate.withdrawnAt
            ? new Date(candidate.withdrawnAt).toISOString()
            : null,
        joinDate:
          candidate.joinDate == null || candidate.joinDate === ''
            ? null
            : new Date(
                /^\d{4}-\d{2}-\d{2}$/.test(String(candidate.joinDate).trim())
                  ? `${String(candidate.joinDate).trim().slice(0, 10)}T12:00:00.000Z`
                  : String(candidate.joinDate)
              ).toISOString(),
        rejectionReason: candidate.rejectionReason || null,
        blacklisted: candidate.blacklisted || false,
        blacklistReason: candidate.blacklistReason || null,
      }
    })
    .filter(Boolean)
}

function FPTKPageContent() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editIdFromUrl = searchParams.get('edit')?.trim() || null
  const backendRole = (user as any)?.role?.name || (user as any)?.role || 'TA_HO'
  const roleName = mapEnumToRole(backendRole)
  const [fptks, setFptks] = useState<FPTK[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [ptFilter, setPtFilter] = useState<string[]>([])
  const [areaFilter, setAreaFilter] = useState<string[]>([])
  const [areaDetailFilter, setAreaDetailFilter] = useState<string[]>([])
  const [officeLocations, setOfficeLocations] = useState<any[]>([])
  const [sortBy, setSortBy] = useState<'location' | 'areaDetail' | 'requestDate' | ''>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedJobPosting, setSelectedJobPosting] = useState<FPTK | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<FPTKUploadResult | null>(null)
  const deepLinkOpenedIdRef = useRef<string | null>(null)
  const loadFptksGenerationRef = useRef(0)
  const [menuAccess, setMenuAccess] = useState<Record<string, any>>({})
  const [menuAccessLoading, setMenuAccessLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(50)
  const [listPagination, setListPagination] = useState({ total: 0, totalPages: 1 })
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const statusFilterKey = useMemo(() => [...statusFilters].sort().join('|'), [statusFilters])
  const locationFilterKey = useMemo(
    () =>
      [
        [...ptFilter].sort().join('|'),
        [...areaFilter].sort().join('|'),
        [...areaDetailFilter].sort().join('|'),
      ].join('~'),
    [ptFilter, areaFilter, areaDetailFilter]
  )

  useModalEscape(isUploadModalOpen && !!uploadResult, () => setIsUploadModalOpen(false))

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const data = await MasterOfficeLocationAPI.getAll()
        if (isMounted) {
          setOfficeLocations(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        console.error('Error loading office locations:', e)
        if (isMounted) setOfficeLocations([])
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  const ptOptions = useMemo(() => {
    const s = new Set<string>()
    officeLocations.forEach((loc: { pt?: string }) => {
      if (loc?.pt) s.add(loc.pt)
    })
    return Array.from(s)
  }, [officeLocations])

  const areaOptions = useMemo(() => {
    const s = new Set<string>()
    officeLocations.forEach((loc: { area?: string }) => {
      if (loc?.area) s.add(loc.area)
    })
    return Array.from(s)
  }, [officeLocations])

  const areaDetailOptions = useMemo(() => {
    const s = new Set<string>()
    officeLocations.forEach((loc: { areaDetail?: string }) => {
      if (loc?.areaDetail) s.add(loc.areaDetail)
    })
    return Array.from(s)
  }, [officeLocations])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  const refreshStatusCounts = async () => {
    try {
      const counts = await FPTKAPI.getCountsByCurrentStatus({
        ...(searchTerm?.trim() ? { search: searchTerm } : {}),
        ...(ptFilter.length
          ? { pt: ptFilter.map((s) => s.trim()).filter(Boolean).join(',') }
          : {}),
        ...(areaFilter.length
          ? { area: areaFilter.map((s) => s.trim()).filter(Boolean).join(',') }
          : {}),
        ...(areaDetailFilter.length
          ? { areaDetail: areaDetailFilter.map((s) => s.trim()).filter(Boolean).join(',') }
          : {}),
      })
      setStatusCounts(counts || {})
    } catch (error) {
      console.error('Error refreshing status counts:', error)
    }
  }

  const applyFptkListUpdate = (mapped: FPTK) => {
    const rowStatus = (mapped.currentStatus || DEFAULT_CURRENT_STATUS).trim()
    const matchesStatusFilter =
      statusFilters.length === 0 ||
      statusFilters.some((filter) => filter.trim() === rowStatus)

    setFptks((prev) => {
      if (!matchesStatusFilter) {
        return prev.filter((f) => f.id !== mapped.id)
      }
      const idx = prev.findIndex((f) => f.id === mapped.id)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = mapped
      return next
    })
    setSelectedJobPosting((prev) => (prev?.id === mapped.id ? mapped : prev))
  }

  const loadFPTKs = async (options?: { silent?: boolean }) => {
    const generation = ++loadFptksGenerationRef.current
    const silent = options?.silent ?? false
    try {
      if (!silent) setLoading(true)
      const currentStatusParam =
        statusFilters.length > 0 ? statusFilters.map((s) => s.trim()).join(',') : undefined
      const listParams: Parameters<typeof FPTKAPI.getAll>[0] = {
        search: searchTerm,
        ...(currentStatusParam ? { currentStatus: currentStatusParam } : {}),
        ...(ptFilter.length
          ? { pt: ptFilter.map((s) => s.trim()).filter(Boolean).join(',') }
          : {}),
        ...(areaFilter.length
          ? { area: areaFilter.map((s) => s.trim()).filter(Boolean).join(',') }
          : {}),
        ...(areaDetailFilter.length
          ? { areaDetail: areaDetailFilter.map((s) => s.trim()).filter(Boolean).join(',') }
          : {}),
      }
      const [response, counts] = await Promise.all([
        FPTKAPI.getAll(listParams, { page, limit: pageSize }),
        FPTKAPI.getCountsByCurrentStatus({
          ...(searchTerm?.trim() ? { search: searchTerm } : {}),
          ...(ptFilter.length
            ? { pt: ptFilter.map((s) => s.trim()).filter(Boolean).join(',') }
            : {}),
          ...(areaFilter.length
            ? { area: areaFilter.map((s) => s.trim()).filter(Boolean).join(',') }
            : {}),
          ...(areaDetailFilter.length
            ? { areaDetail: areaDetailFilter.map((s) => s.trim()).filter(Boolean).join(',') }
            : {}),
        }),
      ])
      if (generation !== loadFptksGenerationRef.current) return
      const mappedFPTKs: FPTK[] = (response.data || []).map((fptk: any) => mapApiFptk(fptk))
      setFptks(mappedFPTKs)
      const pag = response.pagination || {}
      setListPagination({
        total: typeof pag.total === 'number' ? pag.total : mappedFPTKs.length,
        totalPages: Math.max(1, pag.totalPages ?? 1),
      })
      setStatusCounts(counts || {})
    } catch (error) {
      if (generation !== loadFptksGenerationRef.current) return
      console.error('Error loading FPTKs:', error)
      if (!silent) {
        alert('Failed to load positions. Please try again.')
        setFptks([])
        setListPagination({ total: 0, totalPages: 1 })
      }
    } finally {
      if (!silent && generation === loadFptksGenerationRef.current) {
        setLoading(false)
      }
    }
  }

  const fptkListBootRef = useRef(true)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return
    if (fptkListBootRef.current) {
      fptkListBootRef.current = false
      return
    }
    setPage(1)
  }, [searchTerm, pageSize, statusFilterKey, locationFilterKey, isAuthenticated, isLoading])

  useEffect(() => {
    if (!isAuthenticated || isLoading) return
    const delay = searchTerm ? 300 : 0
    const timer = setTimeout(() => {
      loadFPTKs()
    }, delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, searchTerm, statusFilterKey, locationFilterKey, isAuthenticated, isLoading])

  // Deep-link: /fptk?edit=<id> opens Edit modal (fetch by id — not limited to current list page)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return

    if (!editIdFromUrl) {
      deepLinkOpenedIdRef.current = null
      return
    }

    if (deepLinkOpenedIdRef.current === editIdFromUrl) return

    let cancelled = false
    ;(async () => {
      try {
        const fullFptkData = await FPTKAPI.getById(editIdFromUrl)
        if (cancelled) return
        deepLinkOpenedIdRef.current = editIdFromUrl
        setSelectedJobPosting(mapApiFptk(fullFptkData))
        setIsEditModalOpen(true)
      } catch (error) {
        if (!cancelled) {
          console.error('Deep link: could not load position', error)
          deepLinkOpenedIdRef.current = null
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isLoading, editIdFromUrl])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => fptks.some((f) => f.id === id)))
  }, [fptks])

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

  const handleCreateJobPosting = async (jobPostingData: any) => {
    try {
      // Use currentStatus from form data
      const currentStatus = jobPostingData.status || DEFAULT_CURRENT_STATUS
      const statusEnum = mapUiStatusToDbStatus(jobPostingData.status, 'DRAFT')
      const appliedCandidatesPayload = mapAppliedCandidatesForPayload(jobPostingData.appliedCandidates)
      const numberOfPositions =
        jobPostingData.numberOfPositions ??
        jobPostingData.totalRequest ??
        1

      const payload: any = {
        pt: jobPostingData.pt,
        noFktk: jobPostingData.noFktk,
        statusFktk: jobPostingData.statusFktk,
        division: jobPostingData.division,
        section: jobPostingData.section,
        hiringManager: jobPostingData.hiringManager,
        position: jobPostingData.position,
        department: jobPostingData.division,
        location: jobPostingData.area === 'Site' ? 'Site' : 'Head Office',
        employmentType: jobPostingData.employmentType,
        typeGrade: jobPostingData.typeGrade,
        priority: jobPostingData.urgentNormal,
        priorityByMonthYear: jobPostingData.priorityByMonthYear,
        jobSpecification: jobPostingData.jobSpecification,
        criteria: jobPostingData.criteria,
        area: jobPostingData.area,
        areaDetail: jobPostingData.areaDetail,
        additionalOrReplacement: jobPostingData.additionalOrReplacement,
        replacementName: jobPostingData.replacementName,
        resignReason: jobPostingData.resignReason,
        numberOfPositions,
        totalRequest: jobPostingData.totalRequest ?? numberOfPositions,
        requestDate: jobPostingData.requestDate,
        currentStatus,
        status: statusEnum,
        remark: jobPostingData.remark || '',
        requiredSkills: jobPostingData.skills || [],
        appliedCandidates: appliedCandidatesPayload,
      }

      await FPTKAPI.create(payload)
      // Reload FPTKs to get the newly created one
      await loadFPTKs()
      setIsCreateModalOpen(false)
    } catch (error: any) {
      console.error('Error creating FPTK:', error)
      alert(error.response?.data?.message || 'Failed to create position. Please try again.')
    }
  }

  const handleViewJobPosting = async (jobPosting: FPTK) => {
    try {
      // Fetch full FPTK details including applications
      const fullFptkData = await FPTKAPI.getById(jobPosting.id)
      const mappedFptk = mapApiFptk(fullFptkData)
      setSelectedJobPosting(mappedFptk)
      setIsViewModalOpen(true)
    } catch (error) {
      console.error('Error loading FPTK details:', error)
      // Fallback to using the jobPosting from list if fetch fails
      setSelectedJobPosting(jobPosting)
      setIsViewModalOpen(true)
    }
  }

  const handleEditJobPosting = (jobPosting: FPTK) => {
    setSelectedJobPosting(jobPosting)
    setIsEditModalOpen(true)
  }

  const handleCopyJobPosting = async (jobPosting: FPTK) => {
    try {
      const current: any = jobPosting
      const payload: any = {
        pt: current.pt,
        noFktk: '',
        statusFktk: '',
        division: current.department || current.division,
        section: current.section,
        hiringManager: current.hiringManager,
        position: current.position || current.title,
        department: current.department || current.division,
        location: current.location || current.area,
        employmentType: current.employmentType || current.type,
        typeGrade: current.typeGrade,
        priority: current.urgentNormal || current.priority,
        priorityByMonthYear: current.priorityByMonthYear,
        jobSpecification: current.jobSpecification || current.description,
        criteria: current.criteria,
        area: current.area,
        areaDetail: current.areaDetail,
        additionalOrReplacement: current.additionalOrReplacement,
        replacementName: current.replacementName,
        resignReason: current.resignReason,
        numberOfPositions: current.numberOfPositions ?? current.totalRequest ?? 1,
        totalRequest: current.totalRequest ?? current.numberOfPositions ?? 1,
        requestDate: current.requestDate,
        currentStatus: DEFAULT_CURRENT_STATUS,
        status: 'DRAFT',
        remark: current.remark || '',
        requiredSkills: current.skills || [],
      }

      await FPTKAPI.create(payload)
      await loadFPTKs()
      alert('Position copied successfully!')
    } catch (error: any) {
      console.error('Error copying position:', error)
      alert(error.response?.data?.message || 'Failed to copy position. Please try again.')
    }
  }

  const handleDeleteJobPosting = async (jobPosting: FPTK) => {
    const label = jobPosting.title || jobPosting.position || 'this position'
    const confirmed = window.confirm(
      `Delete "${label}" permanently? This removes the position and all related applications. This cannot be undone.`
    )
    if (!confirmed) return
    try {
      setDeletingId(jobPosting.id)
      await FPTKAPI.delete(jobPosting.id)
      if (selectedJobPosting?.id === jobPosting.id) {
        setIsViewModalOpen(false)
        setIsEditModalOpen(false)
        setSelectedJobPosting(null)
      }
      setFptks((prev) => prev.filter((f) => f.id !== jobPosting.id))
      setSelectedIds((prev) => prev.filter((id) => id !== jobPosting.id))
      alert('Position deleted.')
    } catch (error: any) {
      console.error('Error deleting position:', error)
      alert(error.response?.data?.message || 'Failed to delete position. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleUpdateJobPosting = async (updatedData: any) => {
    if (!selectedJobPosting) return

    try {
      const current: any = selectedJobPosting
      const currentStatus = updatedData.status || current.currentStatus || DEFAULT_CURRENT_STATUS
      const statusEnum = mapUiStatusToDbStatus(updatedData.status, current.statusEnum || 'DRAFT')
      const hasAppliedCandidates = Object.prototype.hasOwnProperty.call(updatedData, 'appliedCandidates')
      const appliedCandidatesPayload = hasAppliedCandidates
        ? mapAppliedCandidatesForPayload(updatedData.appliedCandidates)
        : undefined

      const payload: any = {
        pt: updatedData.pt ?? current.pt,
        noFktk: updatedData.noFktk ?? current.noFktk,
        statusFktk: updatedData.statusFktk ?? current.statusFktk,
        division: updatedData.division ?? current.department ?? current.division,
        section: updatedData.section ?? current.section,
        hiringManager: updatedData.hiringManager ?? current.hiringManager,
        position: updatedData.position ?? current.position,
        department: updatedData.division ?? current.department ?? current.division,
        location: updatedData.area ? (updatedData.area === 'Site' ? 'Site' : 'Head Office') : current.location ?? current.area,
        employmentType: updatedData.employmentType ?? current.employmentType ?? current.type,
        typeGrade: updatedData.typeGrade ?? current.typeGrade,
        priority: updatedData.urgentNormal ?? current.urgentNormal ?? current.priority,
        priorityByMonthYear: updatedData.priorityByMonthYear ?? current.priorityByMonthYear,
        jobSpecification: updatedData.jobSpecification ?? current.jobSpecification ?? current.description,
        criteria: updatedData.criteria ?? current.criteria,
        area: updatedData.area ?? current.area,
        areaDetail: updatedData.areaDetail ?? current.areaDetail,
        additionalOrReplacement: updatedData.additionalOrReplacement ?? current.additionalOrReplacement,
        replacementName: updatedData.replacementName ?? current.replacementName,
        resignReason: updatedData.resignReason ?? current.resignReason,
        numberOfPositions: updatedData.numberOfPositions ?? current.numberOfPositions ?? current.totalRequest ?? 1,
        totalRequest: updatedData.totalRequest ?? current.totalRequest ?? current.numberOfPositions ?? 1,
        requestDate: updatedData.requestDate ?? current.requestDate,
        currentStatus,
        status: statusEnum,
        remark: updatedData.remark ?? current.remark,
        requiredSkills: updatedData.skills ?? current.skills ?? [],
        // Include FPTK file fields only if explicitly provided (new file uploaded)
        // If not provided, backend will preserve existing file fields
        ...(updatedData.fptkFile ? { fptkFile: updatedData.fptkFile } : {}),
        // Include fptkReceiveDate only if explicitly provided and not empty
        ...(updatedData.fptkReceiveDate && updatedData.fptkReceiveDate.trim() !== '' 
          ? { fptkReceiveDate: updatedData.fptkReceiveDate } 
          : {}),
      }

      if (hasAppliedCandidates) {
        payload.appliedCandidates = appliedCandidatesPayload || []
      }

      // Debug: Log payload to check if interviews are included
      console.log('FPTK Update Payload:', JSON.stringify(payload, null, 2))
      console.log('Applied Candidates with Interviews:', JSON.stringify(payload.appliedCandidates, null, 2))

      const updated = await FPTKAPI.update(selectedJobPosting.id, payload)
      const mapped = mapApiFptk(updated)
      applyFptkListUpdate(mapped)
      void refreshStatusCounts()
      void loadFPTKs({ silent: true })
      setIsEditModalOpen(false)
      setSelectedJobPosting(null)
    } catch (error: any) {
      console.error('Error updating FPTK:', error)
      alert(error.response?.data?.message || 'Failed to update position. Please try again.')
    }
  }

  const handleStatusUpdate = async (jobPostingId: string, newStatus: string) => {
    try {
      // newStatus is the Current Status value (e.g., "Open", "Pending FKTK", etc.)
      // Map to backend status enum (keep existing logic for backward compatibility)
      const dbStatus = mapUiStatusToDbStatus(newStatus, 'DRAFT')

      const updated = await FPTKAPI.update(jobPostingId, {
        currentStatus: newStatus,
        status: dbStatus,
      })
      const mapped = mapApiFptk(updated)
      applyFptkListUpdate(mapped)
      void refreshStatusCounts()
      void loadFPTKs({ silent: true })
    } catch (error: any) {
      console.error('Error updating FPTK status:', error)
      alert(error.response?.data?.message || 'Failed to update status. Please try again.')
    }
  }

  const handleCandidateStatusUpdate = (jobPostingId: string, candidateId: string, newStatus: string) => {
    // This would typically update the candidate's status in the backend
    // For now, we'll just log the update
    console.log(`Updating candidate ${candidateId} status to ${newStatus} for job posting ${jobPostingId}`)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please upload a valid Excel file (.xlsx or .xls)')
      return
    }

    setIsUploading(true)
    setUploadResult(null)

    try {
      const result = await parseFPTKExcelFile(file)
      
      // Log with clear prefix to avoid filter issues
      console.log('=== FPTK UPLOAD RESULT ===')
      console.log('Total:', result.total)
      console.log('Success:', result.successCount)
      console.log('Failed:', result.failedCount)
      console.log('Failed array length:', result.failed?.length || 0)
      console.log('Full result:', result)
      
      // Save successful FPTKs to database via API
      if (result.success.length > 0) {
        const successCount = result.success.length
        let createdCount = 0
        let failedCount = 0
        const apiFailedItems: any[] = []

        // Process uploads with a small delay to prevent overwhelming the backend
        for (let i = 0; i < result.success.length; i++) {
          const fptkData = result.success[i] as any
          
          // Add small delay between requests (50ms) to prevent rate limiting and backend overload
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          try {
            const status = mapUiStatusToDbStatus((fptkData as any).status, 'DRAFT')
            const rowNumber = (fptkData as any)._rowNumber || 'unknown'

            const payload = {
              pt: (fptkData as any).pt,
              noFktk: (fptkData as any).noFktk || (fptkData as any).fptkNumber,
              statusFktk: (fptkData as any).statusFktk,
              division: (fptkData as any).division || (fptkData as any).department,
              section: (fptkData as any).section,
              hiringManager: (fptkData as any).hiringManager,
              position: (fptkData as any).position || (fptkData as any).title,
              department: (fptkData as any).division || (fptkData as any).department,
              location: (fptkData as any).location || (fptkData as any).area,
              employmentType: (fptkData as any).employmentType || (fptkData as any).type,
              typeGrade: (fptkData as any).typeGrade,
              grade2: (fptkData as any).grade2,
              // Use the original priority value (P0, P1, P2) from Excel Column K
              priority: (fptkData as any).priority || (fptkData as any).urgentNormal || '',
              priorityByMonthYear: (fptkData as any).priorityByMonthYear || '',
              jobSpecification: (fptkData as any).jobSpecification || (fptkData as any).description,
              criteria: (fptkData as any).criteria,
              area: (fptkData as any).area,
              areaDetail: (fptkData as any).areaDetail,
              additionalOrReplacement: (fptkData as any).additionalOrReplacement,
              replacementName: (fptkData as any).replacementName,
              resignReason: (fptkData as any).resignReason,
              totalRequest: (fptkData as any).totalRequest 
                ? (typeof (fptkData as any).totalRequest === 'string' 
                    ? parseInt((fptkData as any).totalRequest, 10) 
                    : (fptkData as any).totalRequest)
                : 1,
              requestDate: (fptkData as any).requestDate && (fptkData as any).requestDate.toString().trim() !== ''
                ? (fptkData as any).requestDate
                : new Date().toISOString().split('T')[0], // Use today's date if empty
              // Use currentStatus from Excel Column U "Current Status"
              currentStatus: (fptkData as any).currentStatus || 'Pending FKTK',
              status: status,
              remark: (fptkData as any).remark || '',
              requiredSkills: (fptkData as any).skills || [],
              appliedCandidates: Array.isArray((fptkData as any).appliedCandidates)
                ? (fptkData as any).appliedCandidates
                : [],
            }

            await FPTKAPI.create(payload)
            createdCount++
          } catch (error: any) {
            console.error('Error creating FPTK from upload:', error)
            failedCount++
            
            // Extract detailed error messages
            let errorMessages: string[] = []
            if (error.response?.data) {
              const errorData = error.response.data
              // Handle validation errors (array format from express-validator)
              if (Array.isArray(errorData.errors)) {
                errorMessages = errorData.errors.map((err: any) => {
                  if (typeof err === 'string') return err
                  // Handle express-validator format: { field, message, value }
                  if (err.message) {
                    return `${err.field ? `${err.field}: ` : ''}${err.message}`
                  }
                  if (err.msg) {
                    return `${err.param ? `${err.param}: ` : ''}${err.msg}`
                  }
                  return JSON.stringify(err)
                })
              }
              // Handle single error message
              else if (errorData.message) {
                errorMessages = [errorData.message]
              }
              // Handle error object with nested errors
              else if (errorData.error) {
                errorMessages = [errorData.error]
              }
            }
            
            // Fallback to generic error
            if (errorMessages.length === 0) {
              const statusCode = error.response?.status
              const errorData = error.response?.data
              if (statusCode === 400) {
                errorMessages = ['Validation failed - please check all required fields']
              } else if (statusCode === 409) {
                // Conflict - usually means duplicate FPTK number
                errorMessages = [errorData?.message || 'FPTK number already exists']
              } else if (statusCode === 503) {
                // Service Unavailable - backend is down or overloaded
                errorMessages = ['Service temporarily unavailable - backend server may be overloaded. Please try again in a few moments or upload in smaller batches.']
              } else if (statusCode === 500) {
                errorMessages = ['Internal server error - please try again or contact support']
              } else {
                errorMessages = [error.message || 'Failed to create in database']
              }
            }

            apiFailedItems.push({
              row: (fptkData as any)._rowNumber || 'unknown',
              data: fptkData,
              errors: errorMessages,
            })
          }
        }

        // Update upload result with API failures
        if (apiFailedItems.length > 0) {
          result.failed = [...(result.failed || []), ...apiFailedItems]
          result.failedCount = (result.failedCount || 0) + apiFailedItems.length
          result.successCount = createdCount
        }

        // Reload FPTKs to show newly created ones
        await loadFPTKs()
      }

      setUploadResult(result)
      // Close modal and navigate back to Open Position list immediately
      setIsUploadModalOpen(false)

      // Immediate, guaranteed feedback even if modal rendering fails
      try {
        alert(`Upload completed. Total: ${result.total}. Success: ${result.successCount}. Failed: ${result.failedCount}.`)
        if (result.failedCount > 0 && Array.isArray(result.failed)) {
          const header = 'Row,Position,Errors\n'

          const rows = result.failed.map((item: any, idx: number) => {
            const rowNum = item?.row ?? (idx + 1)
            const position = getPositionNameForFailedExport(item?.data)
              .replaceAll('"', '""')
            const errors = (Array.isArray(item?.errors) ? item.errors.join('; ') : '')
              .toString()
              .replaceAll('"', '""')
            return `${rowNum},"${position}","${errors}"`
          }).join('\n')

          const csv = `${header}${rows}`
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'fptk_failed_rows.csv'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }
        // Navigate back to the same page (ensures overlay is cleared)
        router.push('/fptk')
      } catch (e) {
        console.error('Post-upload feedback failed:', e)
      }
    } catch (error) {
      alert(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleDownloadTemplate = async () => {
    await generateFPTKTemplate()
  }

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

  const cfg = menuAccess['/fptk'] || {}
  const visibleRoles: string[] = cfg.visibleRoles && cfg.visibleRoles.length ? cfg.visibleRoles : ['SUPER_ADMIN','Management','Head of Division','HRBP','TA_HO','TA_SITE','HIRING_MANAGER']
  
  if (menuAccessLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    )
  }
  
  if (!visibleRoles.includes(roleName)) {
    router.push('/')
    return null
  }
  const perms = cfg.permissions || { view: visibleRoles, create: ['SUPER_ADMIN','TA_HO','HIRING_MANAGER'], edit: ['SUPER_ADMIN','TA_HO','HIRING_MANAGER'] }
  const canCreate = (perms.create || []).includes(roleName) || (perms.create || []).includes('*')
  const canEdit = (perms.edit || []).includes(roleName) || (perms.edit || []).includes('*')
  const canDelete = backendRole === 'SUPER_ADMIN'

  const filteredFptks = fptks
    .sort((a, b) => {
      if (!sortBy) return 0
      
      let aValue = ''
      let bValue = ''
      
      if (sortBy === 'location') {
        aValue = (a.location || '').toLowerCase()
        bValue = (b.location || '').toLowerCase()
      } else if (sortBy === 'areaDetail') {
        aValue = ((a as any).areaDetail || '').toLowerCase()
        bValue = ((b as any).areaDetail || '').toLowerCase()
      } else if (sortBy === 'requestDate') {
        const aTs = a.requestDate ? new Date(a.requestDate).getTime() : 0
        const bTs = b.requestDate ? new Date(b.requestDate).getTime() : 0
        return sortOrder === 'asc' ? aTs - bTs : bTs - aTs
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  
  // Get unique statuses for filter dropdown
  const uniqueStatuses = CURRENT_STATUS_OPTIONS as unknown as string[]

  const visibleRowIds = filteredFptks.map((f) => f.id)
  const selectedVisibleCount = selectedIds.filter((id) => visibleRowIds.includes(id)).length
  const allVisibleSelected = visibleRowIds.length > 0 && selectedVisibleCount === visibleRowIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  const togglePositionSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleToggleSelectAllVisible = () => {
    if (visibleRowIds.length === 0) return
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleRowIds.includes(id)))
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleRowIds])])
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    const toDelete = selectedIds.filter((id) => fptks.some((f) => f.id === id))
    if (toDelete.length === 0) {
      setSelectedIds([])
      return
    }
    const confirmed = window.confirm(
      `Delete ${toDelete.length} position(s) permanently? This removes each position and its related applications. This cannot be undone.`
    )
    if (!confirmed) return
    try {
      setBulkDeleting(true)
      await FPTKAPI.deleteBulk(toDelete)
      setFptks((prev) => prev.filter((f) => !toDelete.includes(f.id)))
      if (selectedJobPosting && toDelete.includes(selectedJobPosting.id)) {
        setIsViewModalOpen(false)
        setIsEditModalOpen(false)
        setSelectedJobPosting(null)
      }
      setSelectedIds([])
      alert(`${toDelete.length} position(s) deleted.`)
    } catch (error: any) {
      console.error('Error bulk deleting positions:', error)
      alert(error.response?.data?.message || 'Failed to delete positions. Please try again.')
    } finally {
      setBulkDeleting(false)
    }
  }

  const selectionBusy = bulkDeleting || deletingId !== null

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Position</h1>
              <p className="mt-1 text-sm text-gray-500">
            Manage positions and recruitment requirements
          </p>
            </div>
            <div className="flex gap-2">
              {canCreate && (
                <>
                  <button
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    Download Template
                  </button>
                  <label className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 cursor-pointer">
                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                    {isUploading ? 'Uploading...' : 'Upload Excel'}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                </>
              )}
              <button 
                disabled={!canCreate}
                onClick={() => canCreate && setIsCreateModalOpen(true)}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${canCreate ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' : 'bg-gray-300 cursor-not-allowed'}`}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create New Position
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectDropdown
              label="PT (entity)"
              options={ptOptions}
              value={ptFilter}
              onChange={setPtFilter}
              placeholder="All entities"
              searchPlaceholder="Search PT..."
            />
            <MultiSelectDropdown
              label="Area"
              options={areaOptions}
              value={areaFilter}
              onChange={setAreaFilter}
              placeholder="All areas"
              searchPlaceholder="Search area..."
            />
            <MultiSelectDropdown
              label="Area detail"
              options={areaDetailOptions}
              value={areaDetailFilter}
              onChange={setAreaDetailFilter}
              placeholder="All area details"
              searchPlaceholder="Search area detail..."
            />
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Status Filter (combined with PT/Area/Area detail via server query) */}
            <div className="min-w-[220px] flex-1 max-w-md">
              <MultiSelectDropdown
                label="Filter by Current Status"
                options={[...uniqueStatuses]}
                value={statusFilters}
                onChange={setStatusFilters}
                placeholder="All statuses"
                searchPlaceholder="Search status..."
              />
            </div>
            {/* Sort by Location */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  const newSortBy = e.target.value as 'location' | 'areaDetail' | 'requestDate' | ''
                  if (newSortBy === sortBy) {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortBy(newSortBy)
                    setSortOrder('asc')
                  }
                }}
                className="block pl-3 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">None</option>
                <option value="location">Location</option>
                <option value="areaDetail">Area Detail</option>
                <option value="requestDate">Request Date</option>
              </select>
              {sortBy && (
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="text-sm text-indigo-600 hover:text-indigo-900"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Per page</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as 10 | 50 | 100)}
                className="block pl-3 pr-8 py-2 border border-gray-300 rounded-md leading-5 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Milestones: count per Current Status (search results) */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">By Current Status</h3>
          <p className="text-xs text-gray-500 mb-3">
            Counts reflect the current search and PT/Area/Area detail filters. Click a status to filter the list
            below; click again to clear that filter.
          </p>
          <div className="flex flex-wrap gap-2">
            {CURRENT_STATUS_OPTIONS.map((st) => {
              const count =
                statusCounts[st] ??
                statusCounts[(st || '').trim()] ??
                (st === DEFAULT_CURRENT_STATUS ? statusCounts[''] ?? 0 : 0)
              const active = statusFilters.includes(st)
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    const onlyThis = statusFilters.length === 1 && statusFilters[0] === st
                    setStatusFilters(onlyThis ? [] : [st])
                    requestAnimationFrame(() => {
                      document.getElementById('fptk-position-list')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    })
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm text-left transition ${
                    active
                      ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-indigo-300 hover:ring-1 hover:ring-indigo-200'
                  }`}
                >
                  <span className="text-gray-700">{st}</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* FPTK List */}
        <div
          id="fptk-position-list"
          className="bg-white shadow overflow-hidden sm:rounded-md"
          data-tour="fptk-list"
        >
          {canDelete && !loading && filteredFptks.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected
                  }}
                  onChange={handleToggleSelectAllVisible}
                  disabled={selectionBusy}
                />
                <span>Select all in this list ({filteredFptks.length})</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0 || selectionBusy}
                  className={`inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md ${
                    selectedIds.length === 0 || selectionBusy
                      ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
                      : 'border-red-300 text-red-700 bg-white hover:bg-red-50'
                  }`}
                >
                  <TrashIcon className="h-4 w-4 mr-1.5" />
                  {bulkDeleting ? 'Deleting…' : `Delete selected (${selectedIds.length})`}
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading positions...</p>
            </div>
          ) : filteredFptks.length === 0 ? (
            <div className="p-6 text-center">
              <BriefcaseIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No positions</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new position.
          </p>
              <div className="mt-6">
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create New Position
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredFptks.map((fptk) => (
                <li key={fptk.id}>
                  <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center min-w-0 flex-1">
                      {canDelete && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 mr-3 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedIds.includes(fptk.id)}
                          onChange={() => togglePositionSelection(fptk.id)}
                          disabled={selectionBusy}
                          aria-label={`Select ${fptk.title || fptk.position}`}
                        />
                      )}
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <BriefcaseIcon className="h-6 w-6 text-indigo-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-indigo-600 truncate">
                            {fptk.title}
                          </p>
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {fptk.currentStatus || DEFAULT_CURRENT_STATUS}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <p>{fptk.department} • {fptk.position} • {fptk.location} • {(fptk as any).areaDetail || 'N/A'}</p>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          <p>Posted {new Date(fptk.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleViewJobPosting(fptk)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View
                      </button>
                      <button 
                        disabled={!canEdit}
                        onClick={() => canEdit && handleEditJobPosting(fptk)}
                        className={`text-sm font-medium flex items-center ${canEdit ? 'text-gray-400 hover:text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button 
                        onClick={() => handleCopyJobPosting(fptk)}
                        className="text-green-600 hover:text-green-900 text-sm font-medium flex items-center"
                        title="Copy Position"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                        Copy
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteJobPosting(fptk)}
                          disabled={selectionBusy}
                          className={`text-sm font-medium flex items-center ${
                            deletingId === fptk.id
                              ? 'text-red-300 cursor-wait'
                              : 'text-red-600 hover:text-red-800'
                          }`}
                          title="Delete position (Super Admin)"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          {deletingId === fptk.id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <span>
            Showing {listPagination.total === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, listPagination.total)} of {listPagination.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {page} / {listPagination.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= listPagination.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

        {/* Create Job Posting Modal */}
        <CreateJobPostingModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateJobPosting}
        />

        {/* View Job Posting Modal */}
        <ViewJobPostingModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false)
            setSelectedJobPosting(null)
          }}
          jobPosting={selectedJobPosting}
          onStatusUpdate={handleStatusUpdate}
        />

        {/* Edit Job Posting Modal */}
        <EditJobPostingModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedJobPosting(null)
          }}
          jobPosting={selectedJobPosting}
          onSave={handleUpdateJobPosting}
          onCandidateStatusUpdate={handleCandidateStatusUpdate}
        />

        {/* Upload Results Modal */}
        {isUploadModalOpen && uploadResult && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsUploadModalOpen(false)}></div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Upload Results</h3>
                    <button
                      onClick={() => setIsUploadModalOpen(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="mb-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">{uploadResult.total}</div>
                        <div className="text-sm text-gray-500">Total Rows</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{uploadResult.successCount}</div>
                        <div className="text-sm text-green-600">Succeeded</div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{uploadResult.failedCount}</div>
                        <div className="text-sm text-red-600">Failed</div>
                      </div>
                    </div>
                  </div>

                  {/* Ultra-safe raw JSON fallback so data is ALWAYS visible */}
                  {uploadResult.failedCount > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Failed Items (raw view)</h4>
                      <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-3 rounded border border-gray-200 text-gray-800 overflow-x-auto max-h-40">
{JSON.stringify(uploadResult.failed, null, 2)}
                      </pre>
                    </div>
                  )}

                  {uploadResult.failedCount > 0 && uploadResult.failed && uploadResult.failed.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Failed Records ({uploadResult.failedCount}):</h4>
                      {/* Simpler, robust list (no table) */}
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {uploadResult.failed.map((item: any, index: number) => {
                          const positionValue = item?.data?.position || item?.data?.Position || '—'
                          const rowNumber = item?.row || (index + 1)
                          const errorsList = Array.isArray(item?.errors) ? item.errors : []
                          return (
                            <details key={`failed-simple-${index}`} className="rounded border border-gray-200 bg-white p-3" open>
                              <summary className="cursor-pointer text-sm text-gray-900">
                                <span className="font-semibold">Row {rowNumber}</span>
                                <span className="mx-2 text-gray-400">•</span>
                                <span className="font-medium">Position:</span> {positionValue}
                                <span className="mx-2 text-gray-400">•</span>
                                <span className="font-medium text-red-600">{errorsList.length} error(s)</span>
                              </summary>
                              <ul className="mt-2 list-disc list-inside text-xs text-red-600 space-y-1">
                                {errorsList.length > 0 ? (
                                  errorsList.map((error: string, errIndex: number) => (
                                    <li key={`failed-simple-${index}-err-${errIndex}`}>{String(error)}</li>
                                  ))
                                ) : (
                                  <li className="text-gray-500">No error details available</li>
                                )}
                              </ul>
                            </details>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {uploadResult.successCount > 0 && (
                    <div className="mb-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-800">
                          <strong>{uploadResult.successCount}</strong> position(s) have been successfully uploaded and added to the list.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function FPTKPage() {
  return (
    <Suspense>
      <FPTKPageContent />
    </Suspense>
  )
}
