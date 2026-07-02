'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useModalEscape } from '@/hooks/useModalEscape'
import { XMarkIcon, DocumentArrowDownIcon, EyeIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { Candidate } from '@/types'
import { generateFormDataDiriPDF } from '@/utils/pdfGenerator'
import { formatFileSize } from '@/utils/fileCompression'
import { ApplicationsAPI } from '@/lib/api'
import { getApplicationStatusPillClass, mapApplicationStatusToUi } from '@/utils/applicationStatusUi'
import PositionEditOverlay from '@/components/PositionEditOverlay'
import { usePositionEditOverlay } from '@/hooks/usePositionEditOverlay'
import ApplicationHistoryModal from '@/components/ApplicationHistoryModal'
import {
  formatCandidateSourceDetailLabel,
  formatCandidateSourceLabel,
  getCandidateSourceFields,
  shouldShowCandidateSourceDetail,
} from '@/utils/candidateSource'

/** Collapse whitespace and unify dash variants so profile "Position applied for" matches FPTK titles */
function normalizeTitleForMatch(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\s+/g, ' ')
}

function fptkJobTitle(f: Record<string, unknown>): string {
  const title = (f.positionTitle ?? f.position ?? '') as string
  return String(title || '').trim()
}

/** True if this profile line is covered by any loaded application (same role, wording may differ slightly). */
function profileTitleMatchedByApplications(profileTitle: string, applications: any[]): boolean {
  const p = normalizeTitleForMatch(profileTitle)
  if (!p) return true
  return applications.some((app) => {
    const f = (app as any).fptk || {}
    const raw = fptkJobTitle(f)
    const a = normalizeTitleForMatch(raw)
    if (!a) return false
    if (a === p) return true
    if (a.includes(p) || p.includes(a)) return true
    const wordsP = p.split(' ').filter((w) => w.length >= 3)
    const wordsA = a.split(' ').filter((w) => w.length >= 3)
    if (wordsP.length === 0 || wordsA.length === 0) return false
    const [shorter, longer] = wordsP.length <= wordsA.length ? [wordsP, wordsA] : [wordsA, wordsP]
    return shorter.every((sw) => longer.some((lw) => lw === sw || lw.includes(sw) || sw.includes(lw)))
  })
}

interface ViewCandidateModalProps {
  isOpen: boolean
  onClose: () => void
  candidate: Candidate | null
}

export default function ViewCandidateModal({ isOpen, onClose, candidate }: ViewCandidateModalProps) {
  const [activeTab, setActiveTab] = useState('personal')
  const [availablePositions, setAvailablePositions] = useState<any[]>([])
  const [canAssignNewPosition, setCanAssignNewPosition] = useState(false)
  const [positionApplications, setPositionApplications] = useState<any[]>([])
  const [loadingPositionApplications, setLoadingPositionApplications] = useState(false)
  const [applicationsRefreshKey, setApplicationsRefreshKey] = useState(0)
  const [historyApplicationId, setHistoryApplicationId] = useState<string | null>(null)

  const positionEdit = usePositionEditOverlay(() => {
    if (candidate?.id) {
      setApplicationsRefreshKey((k) => k + 1)
    }
  })

  const loadPositionApplications = useCallback(async (candidateId: string) => {
    setLoadingPositionApplications(true)
    try {
      const merged: any[] = []
      let page = 1
      const limit = 100
      let totalPages = 1
      do {
        const res = await ApplicationsAPI.getAll({ candidateId }, { page, limit })
        const batch: any[] = (res as any).data || []
        merged.push(...batch)
        totalPages = (res as any).pagination?.totalPages ?? 1
        page += 1
      } while (page <= totalPages)
      setPositionApplications(merged)
    } catch (e) {
      console.error('ViewCandidateModal: load applications', e)
      setPositionApplications([])
    } finally {
      setLoadingPositionApplications(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !candidate?.id) {
      setPositionApplications([])
      return
    }
    void loadPositionApplications(candidate.id)
  }, [isOpen, candidate?.id, applicationsRefreshKey, loadPositionApplications])

  useEffect(() => {
    if (!isOpen) {
      positionEdit.close()
    }
  }, [isOpen, positionEdit.close])

  // Debug: Log candidate files when modal opens
  useEffect(() => {
    if (isOpen && candidate) {
      console.log('ViewCandidateModal - Candidate:', candidate.id)
      console.log('ViewCandidateModal - Candidate files:', candidate.files?.length, candidate.files)
      console.log('ViewCandidateModal - Other files:', candidate.files?.filter(f => f.type === 'other')?.length, candidate.files?.filter(f => f.type === 'other'))
    }
  }, [isOpen, candidate])

  // Load available positions for assignment
  useEffect(() => {
    if (candidate && typeof window !== 'undefined') {
      try {
        const jobPostingsData = localStorage.getItem('jobPostings')
        const jobPostings = jobPostingsData ? JSON.parse(jobPostingsData) : []
        
        // Check if candidate's current position is "On Boarding"
        const currentPosition = (candidate as any).positionAppliedFor || candidate.professionalInfo.currentPosition
        const currentJobPosting = jobPostings.find((job: any) => job.title === currentPosition)
        
        if (currentJobPosting && currentJobPosting.status === 'On Boarding') {
          setCanAssignNewPosition(true)
          // Get all active positions (status != "On Boarding") except current one
          const available = jobPostings.filter((job: any) => 
            job.status !== 'On Boarding' && job.title !== currentPosition
          )
          setAvailablePositions(available)
        } else {
          setCanAssignNewPosition(false)
          setAvailablePositions([])
        }
      } catch (error) {
        console.warn('Could not load job postings from localStorage:', error)
        setCanAssignNewPosition(false)
        setAvailablePositions([])
      }
    }
  }, [candidate])

  useModalEscape(
    isOpen && !!candidate && !positionEdit.isOpen && historyApplicationId === null,
    onClose
  )

  const candidateDisplayName =
    [candidate?.personalInfo?.firstName, candidate?.personalInfo?.lastName].filter(Boolean).join(' ') ||
    'candidate'

  const openPositionEdit = (fptkId: string) => {
    void positionEdit.open(fptkId, candidateDisplayName)
  }

  if (!isOpen || !candidate) {
    return null
  }

  const tabs = [
    { id: 'personal', name: 'Personal Info', icon: '👤' },
    { id: 'application', name: 'Application', icon: '📋' },
    { id: 'jobpostings', name: 'Position Applied For', icon: '💼' },
    { id: 'formDataDiri', name: 'Form Data Diri', icon: '📝' },
    { id: 'files', name: 'Files', icon: '📁' }
  ]

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return 'Not specified'
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString
      if (isNaN(date.getTime())) return 'Not specified'
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'Not specified'
    }
  }

  const navigateToPosition = (fptkId: string) => {
    openPositionEdit(fptkId)
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      screening: 'bg-yellow-100 text-yellow-800',
      interview_scheduled: 'bg-purple-100 text-purple-800',
      interviewed: 'bg-orange-100 text-orange-800',
      shortlisted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      hired: 'bg-emerald-100 text-emerald-800',
      withdrawn: 'bg-gray-100 text-gray-800'
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <>
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: positionEdit.isOpen || historyApplicationId !== null ? 0.45 : 1,
        transition: 'opacity 0.2s ease',
        pointerEvents: positionEdit.isOpen || historyApplicationId !== null ? 'none' : 'auto',
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          minWidth: '700px',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#111827' }}>
                {candidate.personalInfo.firstName} {candidate.personalInfo.lastName}
              </h3>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0 0' }}>
                {candidate.professionalInfo.currentPosition}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#6B7280',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <XMarkIcon style={{ width: '24px', height: '24px' }} />
            </button>
          </div>

          {/* Status Badge */}
          <div style={{ marginBottom: '20px' }}>
            <span 
              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusColor(candidate.status)}`}
            >
              {candidate.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Tab Navigation */}
          <div style={{ borderBottom: '1px solid #E5E7EB', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '32px' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 0',
                    borderBottom: activeTab === tab.id ? '2px solid #4F46E5' : '2px solid transparent',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    color: activeTab === tab.id ? '#4F46E5' : '#6B7280',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {activeTab === 'personal' && (() => {
              const f: any = (candidate as any).formDataDiri || {}
              // Read from candidate object first, then fallback to formDataDiri
              const fullName = f.fullName || `${candidate.personalInfo.firstName} ${candidate.personalInfo.lastName}`.trim()
              
              // Handle dateOfBirth - could be Date object, ISO string, or formatted string
              let dob: string | Date | null = null
              if ((candidate as any).dateOfBirth) {
                dob = (candidate as any).dateOfBirth
              } else if (f.dateOfBirth) {
                dob = f.dateOfBirth
              } else if (candidate.personalInfo.dateOfBirth) {
                dob = candidate.personalInfo.dateOfBirth
              }
              
              const gender = (candidate as any).gender || f.gender || candidate.personalInfo.gender || 'Not specified'
              const maritalStatus = (candidate as any).maritalStatus || f.maritalStatus || candidate.personalInfo.maritalStatus || 'Not specified'
              const ethnicity = (candidate as any).ethnicity || f.ethnicity || 'Not specified'
              const placeOfBirth = (candidate as any).placeOfBirth || f.placeOfBirth || 'Not specified'
              const height = (candidate as any).height ? String((candidate as any).height) : (f.height || 'Not specified')
              const weight = (candidate as any).weight ? String((candidate as any).weight) : (f.weight || 'Not specified')
              const idNumber = (candidate as any).idNumber || (candidate as any).nationalId || f.idNumber || 'Not specified'
              const taxNumber = (candidate as any).taxNumber || (candidate as any).npwpNumber || f.taxNumber || 'Not specified'
              const bpjsNumber = (candidate as any).bpjsNumber || (candidate as any).bpjsHealthNumber || f.bpjsNumber || 'Not specified'
              const healthStatus = (candidate as any).healthStatus || f.healthStatus || 'Not specified'
              const bloodType = (candidate as any).bloodType || f.bloodType || 'Not specified'
              const email = f.email || candidate.contactInfo.email
              const phone = f.phoneNumber || candidate.contactInfo.phone || 'Not specified'
              const currentAddress = (candidate as any).currentAddress || f.currentAddress || candidate.contactInfo.address || 'Not specified'
              const permanentAddress = (candidate as any).permanentAddress || f.permanentAddress || 'Not specified'
              const nationality = candidate.personalInfo.nationality || 'Not specified'
              const { source, sourceDetail } = getCandidateSourceFields(candidate)

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                      Basic Information
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Full Name
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {fullName}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Place of Birth
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {placeOfBirth}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Date of Birth
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {dob ? formatDate(dob) : 'Not specified'}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Gender
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {gender || 'Not specified'}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Marital Status (PTKP)
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {maritalStatus}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Ethnicity
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {ethnicity}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Nationality
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {nationality}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Division
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {Array.isArray((candidate as any).division) && (candidate as any).division.length > 0 
                            ? (candidate as any).division.join(', ') 
                            : (candidate.user?.division || 'Not specified')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                      Contact, IDs, and Experience
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Email
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {email}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Phone
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {phone}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          ID Number (KTP)
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {idNumber}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Tax Number (NPWP)
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {taxNumber}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          BPJS Number
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {bpjsNumber}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Health Status
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {healthStatus}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Years of Experience
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {(candidate as any).yearsOfExperience || candidate.professionalInfo.experience || 0} years
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Source
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {formatCandidateSourceLabel(source)}
                        </div>
                        {shouldShowCandidateSourceDetail(source, sourceDetail) && (
                          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                            {formatCandidateSourceDetailLabel(source)}: {sourceDetail}
                          </div>
                        )}
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Skills
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {(((candidate as any).skills || candidate.professionalInfo.skills) || []).map((skill: string, idx: number) => (
                            <span key={idx} style={{ padding: '4px 8px', backgroundColor: '#e0e7ff', color: '#3730a3', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                              {skill}
                            </span>
                          ))}
                          {(((candidate as any).skills || candidate.professionalInfo.skills) || []).length === 0 && (
                            <span style={{ fontSize: '14px', color: '#6B7280' }}>No skills listed</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Blood Type
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {bloodType}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Height / Weight
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {height} / {weight}
                        </div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Current Address
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {currentAddress}
                        </div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                          Permanent Address
                        </span>
                        <div style={{ fontSize: '14px', color: '#111827' }}>
                          {permanentAddress}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            

            {activeTab === 'application' && (() => {
              const { source, sourceDetail } = getCandidateSourceFields(candidate)

              return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                    Application Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                        Applied Date
                      </span>
                      <div style={{ fontSize: '14px', color: '#111827' }}>
                        {candidate.applicationInfo?.appliedDate ? formatDate(candidate.applicationInfo.appliedDate) : 'Not specified'}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                        Source
                      </span>
                      <div style={{ fontSize: '14px', color: '#111827' }}>
                        {formatCandidateSourceLabel(source)}
                      </div>
                      {shouldShowCandidateSourceDetail(source, sourceDetail) && (
                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                          {formatCandidateSourceDetailLabel(source)}: {sourceDetail}
                        </div>
                      )}
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                        Status
                      </span>
                      <div style={{ fontSize: '14px', color: '#111827' }}>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(candidate.applicationInfo?.status || candidate.status)}`}>
                          {(candidate.applicationInfo?.status || candidate.status).replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                        Created
                      </span>
                      <div style={{ fontSize: '14px', color: '#111827' }}>
                        {formatDate(candidate.createdAt)}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', textTransform: 'uppercase' }}>
                        Notes
                      </span>
                      <div style={{ fontSize: '14px', color: '#111827', marginTop: '4px' }}>
                        {candidate.applicationInfo?.notes || 'No notes available'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )
            })()}

            {activeTab === 'jobpostings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                    Position applied for
                  </h4>
                  {loadingPositionApplications ? (
                    <div
                      style={{
                        padding: '24px',
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: '14px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        backgroundColor: '#f9fafb',
                      }}
                    >
                      Loading application pipeline…
                    </div>
                  ) : (() => {
                    const appliedTitlesFromCandidate: string[] = Array.isArray((candidate as any).positionAppliedFor)
                      ? (candidate as any).positionAppliedFor
                      : (candidate as any).positionAppliedFor
                        ? [String((candidate as any).positionAppliedFor)]
                        : []
                    const orphanOnlyOnProfile = appliedTitlesFromCandidate.filter(
                      (t) =>
                        t &&
                        t.trim() &&
                        !profileTitleMatchedByApplications(t, positionApplications)
                    )

                    const rows: ReactNode[] = []

                    positionApplications.forEach((app) => {
                      const f = (app as any).fptk || {}
                      const title = fptkJobTitle(f) || '—'
                      const fptkId = String((app as any).fptkId || f.id || '').trim()
                      const department = f.department || f.division || '—'
                      const uiStatus = mapApplicationStatusToUi((app as any).status)
                      const appliedAt = (app as any).appliedAt
                      const pill = getApplicationStatusPillClass(uiStatus)
                      rows.push(
                        <div
                          key={(app as any).id}
                          style={{
                            padding: '16px',
                            backgroundColor: '#ffffff',
                            borderRadius: '10px',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              {fptkId ? (
                                <button
                                  type="button"
                                  onClick={() => navigateToPosition(fptkId)}
                                  style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#4f46e5',
                                    margin: '0 0 6px 0',
                                    padding: 0,
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    textDecoration: 'underline',
                                  }}
                                  title="Open position"
                                >
                                  {title}
                                </button>
                              ) : (
                                <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 6px 0' }}>{title}</h5>
                              )}
                              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Division: {department}</p>
                              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Applied: {appliedAt ? formatDate(appliedAt) : '—'}</p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                              <span
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  backgroundColor: pill.backgroundColor,
                                  color: pill.color,
                                }}
                              >
                                {uiStatus}
                              </span>
                              <button
                                type="button"
                                onClick={() => setHistoryApplicationId((app as any).id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  color: '#6366f1',
                                  background: 'none',
                                  border: '1px solid #c7d2fe',
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  cursor: 'pointer',
                                }}
                                title="View status history"
                              >
                                <EyeIcon style={{ width: '12px', height: '12px' }} />
                                History
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })

                    orphanOnlyOnProfile.forEach((title) => {
                      rows.push(
                        <div
                          key={`orphan-${title}`}
                          style={{
                            padding: '16px',
                            backgroundColor: '#fffbeb',
                            borderRadius: '10px',
                            border: '1px solid #fde68a',
                          }}
                        >
                          <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 6px 0' }}>{title}</h5>
                          <p style={{ fontSize: '12px', color: '#92400e', margin: 0 }}>
                            Listed on profile but no application record. Status will show here once the candidate is in the
                            position pipeline.
                          </p>
                        </div>
                      )
                    })

                    if (rows.length > 0) {
                      return <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{rows}</div>
                    }
                    return (
                      <div
                        style={{
                          padding: '24px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          textAlign: 'center',
                        }}
                      >
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No applications in the pipeline for this candidate yet.</p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'formDataDiri' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {(() => {
                  let formData = (candidate as any).formDataDiri
                  // Parse formDataDiri if it's a string
                  if (typeof formData === 'string') {
                    try {
                      formData = JSON.parse(formData)
                    } catch (e) {
                      console.error('Error parsing formDataDiri:', e)
                      formData = null
                    }
                  }
                  // Debug: Log formData to check if source fields are present
                  if (formData) {
                    console.log('FormDataDiri data:', formData)
                    console.log('Source field:', formData.source)
                    console.log('SourceDetail field:', formData.sourceDetail)
                  }
                  if (!formData) {
                    return (
                      <div style={{
                        padding: '24px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        textAlign: 'center'
                      }}>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                          Form Data Diri has not been submitted yet.
                        </p>
                      </div>
                    )
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Print Button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            console.log('PDF button clicked')
                            console.log('Form data:', formData)
                            try {
                              const candidateName = `${candidate.personalInfo?.firstName || ''} ${candidate.personalInfo?.lastName || ''}`.trim() || 'Candidate'
                              console.log('Generating PDF for:', candidateName)
                              generateFormDataDiriPDF(formData, candidateName, formData.submittedAt)
                              console.log('PDF generation completed')
                            } catch (error: any) {
                              console.error('Error generating PDF:', error)
                              console.error('Error stack:', error?.stack)
                              alert(`Failed to generate PDF: ${error?.message || 'Unknown error'}. Please check the console for details.`)
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: '#4F46E5',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          <PrinterIcon style={{ width: '18px', height: '18px' }} />
                          Print to PDF
                        </button>
                      </div>
                      {/* Submission Info & User Concerns */}
                      {formData.submittedAt && (
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#f0fdf4',
                          borderRadius: '8px',
                          border: '1px solid #86efac'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534' }}>
                            Submitted: {formatDate(formData.submittedAt)}
                          </div>
                        </div>
                      )}

                      {/* User Concerns Summary */}
                      {(() => {
                        const normalizeBool = (v: any) => {
                          if (typeof v === 'boolean') return v
                          if (typeof v === 'string') {
                            const s = v.trim().toLowerCase()
                            return s === 'yes' || s === 'true' || s === 'on' || s === '1'
                          }
                          if (typeof v === 'number') return v === 1
                          return false
                        }
                        const concerns: { label: string, value: boolean, details?: string }[] = [
                          { label: 'Serious Illness / Accident', value: normalizeBool(formData.seriousIllness), details: formData.seriousIllnessDetails },
                          { label: 'Problems with Authorities', value: normalizeBool(formData.authorityProblems), details: formData.authorityProblemsDetails },
                          { label: 'Physical Problems', value: normalizeBool(formData.physicalProblems), details: formData.physicalProblemsDetails },
                          { label: 'Previously Employed by Company/Group', value: normalizeBool(formData.previousEmployment), details: formData.previousEmploymentDetails },
                          { label: 'Family/Relative Employed by Company/Group', value: normalizeBool(formData.familyInCompany), details: formData.familyInCompanyDetails },
                        ]
                        const flagged = concerns.filter(c => c.value)
                        if (flagged.length === 0) return null
                        return (
                          <div style={{
                            padding: '12px',
                            backgroundColor: '#fff7ed',
                            borderRadius: '8px',
                            border: '1px solid #fdba74'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#9a3412', marginBottom: '8px' }}>
                              User Concerns
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '18px', color: '#7c2d12', fontSize: '13px' }}>
                              {flagged.map((c, idx) => (
                                <li key={idx} style={{ marginBottom: '4px' }}>
                                  <strong>{c.label}:</strong> Yes{c.details ? ` — ${c.details}` : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })()}

                      {/* Personal Information */}
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                          Personal Information
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Full Name</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.fullName || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Place of Birth</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.placeOfBirth || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Date of Birth</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.dateOfBirth || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Gender</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.gender || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Ethnicity</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.ethnicity || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Marital Status</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.maritalStatus || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Height (cm)</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.height || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Weight (kg)</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.weight || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>ID Number (KTP)</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.idNumber || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Tax Number (NPWP)</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.taxNumber || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>BPJS Number</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.bpjsNumber || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Health Status</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.healthStatus || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Driving License</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.drivingLicense || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Blood Type</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.bloodType || '-'}</div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Current Address</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.currentAddress || '-'}</div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Permanent Address</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.permanentAddress || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Phone Number</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.phoneNumber || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Email</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.email || '-'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Family Members */}
                      {formData.familyMembers && formData.familyMembers.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                            Family Members ({formData.familyMembers.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {formData.familyMembers.map((member: any, index: number) => (
                              <div key={index} style={{
                                padding: '12px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  <div><strong>Relation:</strong> {member.relationType || '-'}</div>
                                  <div><strong>Name:</strong> {member.name || '-'}</div>
                                  <div><strong>Gender:</strong> {member.gender || '-'}</div>
                                  <div><strong>Date of Birth:</strong> {member.dateOfBirth || '-'}</div>
                                  <div><strong>Education:</strong> {member.education || '-'}</div>
                                  <div><strong>Occupation:</strong> {member.occupation || '-'}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Education */}
                      {formData.education && formData.education.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                            Education ({formData.education.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {formData.education.map((edu: any, index: number) => (
                              <div key={index} style={{
                                padding: '12px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div><strong>Type:</strong> {edu.type || '-'}</div>
                                <div><strong>Period:</strong> {edu.startMonth}/{edu.startYear} - {edu.endMonth || 'Present'}/{edu.endYear || ''}</div>
                                <div><strong>Institution:</strong> {edu.institutionName || '-'}</div>
                                <div><strong>Major:</strong> {edu.major || '-'}</div>
                                <div><strong>Place:</strong> {edu.place || '-'}</div>
                                <div><strong>Certification:</strong> {edu.certification || '-'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Languages */}
                      {formData.languages && formData.languages.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                            Languages ({formData.languages.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {formData.languages.map((lang: any, index: number) => (
                              <div key={index} style={{
                                padding: '12px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div><strong>Language:</strong> {lang.language || '-'}</div>
                                <div><strong>Speaking:</strong> {lang.speaking || '-'}</div>
                                <div><strong>Writing:</strong> {lang.writing || '-'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Social Activities */}
                      {formData.socialActivities && formData.socialActivities.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                            Social Activities ({formData.socialActivities.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {formData.socialActivities.map((activity: any, index: number) => (
                              <div key={index} style={{
                                padding: '12px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div><strong>Period:</strong> {activity.startMonth}/{activity.startYear} - {activity.endMonth || 'Present'}/{activity.endYear || ''}</div>
                                <div><strong>Organization:</strong> {activity.organizationName || '-'}</div>
                                <div><strong>Place:</strong> {activity.place || '-'}</div>
                                <div><strong>Position:</strong> {activity.position || '-'}</div>
                                <div><strong>Description:</strong> {activity.organizationDescription || '-'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* References */}
                      {formData.references && formData.references.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                            References ({formData.references.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {formData.references.map((ref: any, index: number) => (
                              <div key={index} style={{
                                padding: '12px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div><strong>Name:</strong> {ref.name || '-'}</div>
                                <div><strong>Company:</strong> {ref.companyName || '-'}</div>
                                <div><strong>Address:</strong> {ref.address || '-'}</div>
                                <div><strong>Phone:</strong> {ref.phoneNo || '-'}</div>
                                <div><strong>Position:</strong> {ref.position || '-'}</div>
                                <div><strong>Relation:</strong> {ref.relation || '-'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Work Experience */}
                      {formData.workExperience && formData.workExperience.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                            Work Experience ({formData.workExperience.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {formData.workExperience.map((work: any, index: number) => (
                              <div key={index} style={{
                                padding: '12px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div><strong>Period:</strong> {work.startMonth}/{work.startYear} - {work.endMonth || 'Present'}/{work.endYear || ''}</div>
                                <div><strong>Company:</strong> {work.companyName || '-'}</div>
                                <div><strong>Address:</strong> {work.companyAddress || '-'}</div>
                                <div><strong>Starting Position:</strong> {work.startingPosition || '-'}</div>
                                <div><strong>Last Position:</strong> {work.lastPosition || '-'}</div>
                                <div><strong>Starting Salary:</strong> {work.startingSalary || '-'}</div>
                                <div><strong>Last Salary:</strong> {work.lastSalary || '-'}</div>
                                <div><strong>Resignation Reason:</strong> {work.resignationReason || '-'}</div>
                                <div><strong>Job Description:</strong> {work.jobDescription || '-'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Other Information */}
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                          Other Information
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Emergency Contact</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>
                              {formData.emergencyContactName || '-'} ({formData.emergencyRelation || '-'})
                            </div>
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>{formData.emergencyContactAddress || '-'}</div>
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>Phone: {formData.emergencyPhoneNo || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Can Contact References</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.canContactReferences ? 'Yes' : 'No'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Previous Employment</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.previousEmployment ? 'Yes' : 'No'}</div>
                            {formData.previousEmployment && formData.previousEmploymentDetails && (
                              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{formData.previousEmploymentDetails}</div>
                            )}
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Family in Company</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.familyInCompany ? 'Yes' : 'No'}</div>
                            {formData.familyInCompany && formData.familyInCompanyDetails && (
                              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{formData.familyInCompanyDetails}</div>
                            )}
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Serious Illness</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.seriousIllness ? 'Yes' : 'No'}</div>
                            {formData.seriousIllness && formData.seriousIllnessDetails && (
                              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{formData.seriousIllnessDetails}</div>
                            )}
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Authority Problems</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.authorityProblems ? 'Yes' : 'No'}</div>
                            {formData.authorityProblems && formData.authorityProblemsDetails && (
                              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{formData.authorityProblemsDetails}</div>
                            )}
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Hobbies</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.hobbies || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Physical Problems</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.physicalProblems ? 'Yes' : 'No'}</div>
                            {formData.physicalProblems && formData.physicalProblemsDetails && (
                              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{formData.physicalProblemsDetails}</div>
                            )}
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Motivation to Join</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.motivationToJoin || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Willing to Relocate</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.willingToRelocate ? 'Yes' : 'No'}</div>
                            {!formData.willingToRelocate && formData.relocationReason && (
                              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{formData.relocationReason}</div>
                            )}
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Willing to Travel</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.willingToTravel ? 'Yes' : 'No'}</div>
                            {!formData.willingToTravel && formData.travelReason && (
                              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{formData.travelReason}</div>
                            )}
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Current Benefits</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.currentBenefits || '-'}</div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Expected Salary & Benefits</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.expectedSalary || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Available Start Date</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>{formData.availableStartDate || '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>Source</span>
                            <div style={{ fontSize: '14px', color: '#111827' }}>
                              {formatCandidateSourceLabel(
                                getCandidateSourceFields({ ...candidate, languages: formData }).source ||
                                  formData.source ||
                                  ''
                              )}
                            </div>
                            {(() => {
                              const { source, sourceDetail } = getCandidateSourceFields({
                                ...candidate,
                                languages: formData,
                              } as Record<string, unknown>)
                              const resolvedSource = source || formData.source || ''
                              const resolvedDetail = sourceDetail || formData.sourceDetail || ''
                              if (!shouldShowCandidateSourceDetail(resolvedSource, resolvedDetail)) return null
                              return (
                                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                                  {formatCandidateSourceDetailLabel(resolvedSource)}: {resolvedDetail}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Declaration */}
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#eef2ff',
                        borderRadius: '8px',
                        border: '1px solid #c7d2fe'
                      }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
                          Declaration
                        </div>
                        <p style={{ fontSize: '12px', color: '#374151', margin: 0, marginBottom: '8px' }}>
                          "I hereby declare that the above information is true. If any of the information is later found to be false or contradictory, I am willing to be subject to legal action in accordance with applicable laws and to resign from the company for committing fraud."
                        </p>
                        {(() => {
                          const v = (formData as any).declarationAccepted
                          let accepted = false
                          if (typeof v === 'boolean') accepted = v
                          else if (typeof v === 'string') {
                            const s = v.trim().toLowerCase()
                            accepted = s === 'yes' || s === 'true' || s === 'on' || s === '1'
                          } else if (typeof v === 'number') accepted = v === 1
                          return (
                            <div style={{ fontSize: '12px', color: '#111827' }}>
                              Acceptance: {accepted ? 'Accepted' : 'Not accepted'}
                              {formData.submittedAt && (
                                <span> • Submitted: {formatDate(formData.submittedAt)}</span>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {activeTab === 'files' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                    Documents & Files
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* CV Document */}
                    <div 
                      style={{
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <DocumentArrowDownIcon style={{ width: '24px', height: '24px', color: '#6B7280' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                          CV Document
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>
                          {candidate.files?.find(f => f.type === 'cv')?.name || 'No CV uploaded'}
                        </div>
                        {candidate.files?.find(f => f.type === 'cv') && (
                          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                            Uploaded: {new Date(candidate.files.find(f => f.type === 'cv')!.uploadedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <button
                        style={{
                          backgroundColor: candidate.files?.find(f => f.type === 'cv') ? '#4F46E5' : '#9CA3AF',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: candidate.files?.find(f => f.type === 'cv') ? 'pointer' : 'not-allowed'
                        }}
                        disabled={!candidate.files?.find(f => f.type === 'cv')}
                        onClick={() => {
                          const cvFile = candidate.files?.find(f => f.type === 'cv')
                          if (!cvFile) {
                            return
                          }

                          if (cvFile.url) {
                            window.open(cvFile.url, '_blank')
                            return
                          }

                          if (cvFile.data) {
                            // Convert base64 to blob and download
                            try {
                              const parts = cvFile.data.split(',')
                              const base64Data = parts.length > 1 ? parts[1] : parts[0]
                              const byteCharacters = atob(base64Data)
                              const byteNumbers = new Array(byteCharacters.length)
                              for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i)
                              }
                              const byteArray = new Uint8Array(byteNumbers)
                              const blob = new Blob([byteArray], { type: cvFile.mimeType || 'application/octet-stream' })

                              const link = document.createElement('a')
                              link.href = URL.createObjectURL(blob)
                              link.download = cvFile.name
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                              URL.revokeObjectURL(link.href)
                            } catch (error) {
                              console.error('Failed to download CV from base64 data:', error)
                              alert('Unable to download CV. Please try again later.')
                            }
                            return
                          }

                          alert('CV file is not available for download.')
                        }}
                      >
                        {candidate.files?.find(f => f.type === 'cv') ? 'Download' : 'No File'}
                      </button>
                    </div>

                    {/* Additional Files */}
                    {candidate.files && candidate.files.filter(f => f.type === 'other').length > 0 && (
                      <div style={{ marginTop: '24px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                          Additional Files ({candidate.files.filter(f => f.type === 'other').length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {candidate.files
                            .filter(f => f.type === 'other')
                            .map((file) => (
                              <div
                                key={file.id}
                                style={{
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '8px',
                                  padding: '16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px'
                                }}
                              >
                                <DocumentArrowDownIcon style={{ width: '24px', height: '24px', color: '#6B7280' }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                                    {file.name}
                                  </div>
                                  {file.size && (
                                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                      Size: {formatFileSize(file.size)}
                                    </div>
                                  )}
                                  {file.uploadedAt && (
                                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                                      Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                                <button
                                  style={{
                                    backgroundColor: '#4F46E5',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => {
                                    if (file.url) {
                                      window.open(file.url, '_blank')
                                      return
                                    }

                                    if (file.data) {
                                      // Convert base64 to blob and download
                                      try {
                                        const parts = file.data.split(',')
                                        const base64Data = parts.length > 1 ? parts[1] : parts[0]
                                        const byteCharacters = atob(base64Data)
                                        const byteNumbers = new Array(byteCharacters.length)
                                        for (let i = 0; i < byteCharacters.length; i++) {
                                          byteNumbers[i] = byteCharacters.charCodeAt(i)
                                        }
                                        const byteArray = new Uint8Array(byteNumbers)
                                        const blob = new Blob([byteArray], { type: file.mimeType || 'application/octet-stream' })

                                        const link = document.createElement('a')
                                        link.href = URL.createObjectURL(blob)
                                        link.download = file.name
                                        document.body.appendChild(link)
                                        link.click()
                                        document.body.removeChild(link)
                                        URL.revokeObjectURL(link.href)
                                      } catch (error) {
                                        console.error('Failed to download file from base64 data:', error)
                                        alert('Unable to download file. Please try again later.')
                                      }
                                      return
                                    }

                                    alert('File is not available for download.')
                                  }}
                                >
                                  Download
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#4F46E5',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <PositionEditOverlay
      isOpen={positionEdit.isOpen}
      jobPosting={positionEdit.jobPosting}
      loading={positionEdit.loading}
      onClose={positionEdit.close}
      onSave={positionEdit.handleSave}
      headerBackLabel={`Back to ${positionEdit.backLabel || candidateDisplayName}`}
      candidateStatusOnly={positionEdit.candidateStatusOnly}
    />

    <ApplicationHistoryModal
      isOpen={historyApplicationId !== null}
      onClose={() => setHistoryApplicationId(null)}
      applicationId={historyApplicationId}
      overlayZIndex={10060}
    />
    </>
  )
}
