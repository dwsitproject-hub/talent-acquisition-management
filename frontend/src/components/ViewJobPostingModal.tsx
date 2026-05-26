'use client'

import { useState, useEffect } from 'react'
import { useModalEscape } from '@/hooks/useModalEscape'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { FPTK, Candidate } from '@/types'
import ViewCandidateModal from './ViewCandidateModal'
import { CandidatesAPI } from '@/lib/api'
import { fetchApplicationsForFptk } from '@/utils/mapFptkApplication'
import { mapApiCandidate } from '@/app/candidates/page'
import { mapApplicationStatusToUi } from '@/utils/applicationStatusUi'

// Helper to get API base URL without /api
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const protocol = window.location.protocol
    return `${protocol}//${hostname}:4000`
  }
  return 'http://localhost:4000'
}

interface ViewJobPostingModalProps {
  isOpen: boolean
  onClose: () => void
  jobPosting: FPTK | null
  onStatusUpdate?: (jobPostingId: string, newStatus: string) => void
}

const formatEmploymentType = (value?: string) => {
  const normalized = (value || '').toLowerCase()
  if (normalized === 'contract') return 'Contract'
  if (normalized === 'internship') return 'Internship'
  if (normalized === 'full-time' || normalized === 'full time employee') return 'Full Time Employee'
  if (normalized === 'part-time') return 'Part Time'
  return value || '-'
}

export default function ViewJobPostingModal({ isOpen, onClose, jobPosting, onStatusUpdate }: ViewJobPostingModalProps) {
  const [appliedCandidates, setAppliedCandidates] = useState<any[]>([])
  const [expandedInterviewSections, setExpandedInterviewSections] = useState<Set<string>>(new Set())
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false)
  const [loadingCandidate, setLoadingCandidate] = useState(false)

  // Load applied candidates when job posting changes
  useEffect(() => {
    const loadAppliedCandidates = async () => {
      if (!jobPosting) {
        setAppliedCandidates([])
        return
      }

      // First, use applications from the FPTK (proper Application records)
      let candidates: any[] = []
      
      if (Array.isArray((jobPosting as any).appliedCandidates)) {
        candidates = (jobPosting as any).appliedCandidates.map((candidate: any) => ({
          ...candidate,
          status: candidate.status || mapApplicationStatusToUi(candidate.backendStatus),
          backendStatus: candidate.backendStatus || candidate.status,
          skills: candidate.skills || [],
          interviews: candidate.interviews || [],
          rejectedDate: candidate.rejectedDate || candidate.rejectedAt || null,
          withdrawDate: candidate.withdrawDate || candidate.withdrawnAt || null,
        }))
      }

      // If embedded FPTK data has no applications, load by fptk id (never by position title)
      if (candidates.length === 0 && jobPosting.id) {
        try {
          candidates = await fetchApplicationsForFptk(jobPosting.id)
        } catch (error) {
          console.error('ViewJobPostingModal: load applications by fptkId', error)
        }
      }

      setAppliedCandidates(candidates)
    }

    loadAppliedCandidates()
  }, [jobPosting])

  useModalEscape(isOpen && !!jobPosting, onClose)

  if (!isOpen || !jobPosting) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const priorityLabel = (() => {
    const p = (jobPosting as any).urgentNormal as string | undefined
    if (p === 'P0' || p === 'P1' || p === 'P2') return p
    // derive from priority field
    const level = (jobPosting as any).priority || jobPosting.priority
    if (level === 'urgent') return 'P0'
    if (level === 'high') return 'P1'
    if (level === 'medium') return 'P2'
    return '-'
  })()

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '95%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: 0
          }}>
            Position Details
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              color: '#6b7280'
            }}
          >
            <XMarkIcon style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Basic Information */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
                Basic Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(jobPosting as any).pt && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>PT</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).pt}</p>
                  </div>
                )}
                {(jobPosting as any).noFktk && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>No FKTK</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).noFktk}</p>
                  </div>
                )}
                {(jobPosting as any).statusFktk && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Status FKTK</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).statusFktk}</p>
                  </div>
                )}
                {(jobPosting as any).fptkReceiveDate && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>FPTK Receive Date</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{formatDate((jobPosting as any).fptkReceiveDate)}</p>
                  </div>
                )}
                {((jobPosting as any).fptkFilePath || (jobPosting as any).fptkFileName) && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>FPTK File</label>
                    <div style={{ marginTop: '4px' }}>
                      {(jobPosting as any).fptkFilePath ? (
                        <a
                          href={`${getApiBaseUrl()}${(jobPosting as any).fptkFilePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px',
                            color: '#2563eb',
                            textDecoration: 'none',
                            fontWeight: '500'
                          }}
                        >
                          <span>📄</span>
                          <span>{(jobPosting as any).fptkFileName || 'Download FPTK File'}</span>
                        </a>
                      ) : (jobPosting as any).fptkFileName ? (
                        <p style={{ fontSize: '14px', color: '#10b981', margin: 0 }}>
                          ✓ {(jobPosting as any).fptkFileName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Division</label>
                  <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{jobPosting.department}</p>
                </div>
                {(jobPosting as any).section && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Section</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).section}</p>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Position</label>
                  <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{jobPosting.title}</p>
                </div>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Employment Type</label>
                  <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>
                    {formatEmploymentType((jobPosting as any).employmentType || jobPosting.type)}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Location</label>
                  <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{jobPosting.location}</p>
                </div>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Area Detail</label>
                  <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).areaDetail || 'Not specified'}</p>
                </div>
              </div>
            </div>

            {/* Status & Priority */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
                Status & Priority
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Current Status</label>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3',
                    margin: '4px 0 0 0'
                  }}>
                    {(jobPosting as any).currentStatus || (jobPosting as any).status || 'Pending FKTK'}
                  </span>
                </div>
                {(jobPosting as any).typeGrade && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Type Grade</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).typeGrade}</p>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Priority</label>
                  <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>
                    {priorityLabel} {jobPosting.priority ? `(${jobPosting.priority})` : ''}
                  </p>
                </div>
                {(jobPosting as any).criteria && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Criteria</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).criteria}</p>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Hiring Manager</label>
                  <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{jobPosting.hiringManager}</p>
                </div>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Years of Experience Required</label>
                  <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>
                    {(jobPosting as any).yearsOfExperience ? `${(jobPosting as any).yearsOfExperience} years` : 'Not specified'}
                  </p>
                </div>
                {(jobPosting as any).totalRequest && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Total Request</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).totalRequest}</p>
                  </div>
                )}
                {(jobPosting as any).requestDate && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Request Date</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{formatDate((jobPosting as any).requestDate)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
              Additional Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(jobPosting as any).additionalOrReplacement && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Additional or Replacement</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).additionalOrReplacement}</p>
                  </div>
                )}
                {(jobPosting as any).replacementName && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Replacement Name</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).replacementName}</p>
                  </div>
                )}
                {(jobPosting as any).resignReason && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Resign Reason</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).resignReason}</p>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Remark</label>
                  <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{(jobPosting as any).remark || 'Not specified'}</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(jobPosting as any).priorityByMonthYear && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Priority by Month-Year</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{(jobPosting as any).priorityByMonthYear}</p>
                  </div>
                )}
                {jobPosting.deadline && (
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Deadline</label>
                    <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{formatDate(jobPosting.deadline)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Job Description */}
          {jobPosting.description && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                Job Description
              </h3>
              <div style={{
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                <p style={{ fontSize: '14px', color: '#374151', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {jobPosting.description}
                </p>
              </div>
            </div>
          )}

          {/* Requirements */}
          {jobPosting.requirements && jobPosting.requirements.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                Requirements
              </h3>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {jobPosting.requirements.map((req, index) => (
                  <li key={index} style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills */}
          {(jobPosting as any).skills && (jobPosting as any).skills.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                Required Skills (for AI candidate matching)
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(jobPosting as any).skills.map((skill: string, index: number) => (
                  <span key={index} style={{
                    padding: '4px 8px',
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Milestones - Always show if milestones exist or if we have a current status */}
          {(((jobPosting as any).milestones && (jobPosting as any).milestones.length > 0) || (jobPosting as any).currentStatus) && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                Status Milestones Timeline
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto', padding: '20px 0' }}>
                {(() => {
                  const fixedMilestones = [
                    'Pending FKTK',
                    'Open',
                    'Hold',
                    'Re-Open',
                    'Internal Movement',
                    'Cancel'
                  ]
                  
                  const milestoneData = (jobPosting as any).milestones || []
                  const currentStatus = (jobPosting as any).currentStatus || (jobPosting as any).status || 'Pending FKTK'
                  const currentIndex = fixedMilestones.indexOf(currentStatus)
                  
                  return fixedMilestones.map((milestone, index) => {
                    const isCompleted = index < currentIndex
                    const isCurrent = index === currentIndex
                    
                    // Find the milestone data for this specific milestone
                    // Try exact match first, then try partial match
                    let milestoneInfo = milestoneData.find((m: any) => m.status === milestone)
                    if (!milestoneInfo) {
                      // Try case-insensitive match
                      milestoneInfo = milestoneData.find((m: any) => 
                        m.status && m.status.toLowerCase() === milestone.toLowerCase()
                      )
                    }
                    if (!milestoneInfo) {
                      // Try partial match (e.g., "CV Hunting" matches "CV Hunting (Sourcing Candidate)")
                      milestoneInfo = milestoneData.find((m: any) => 
                        m.status && (
                          milestone.toLowerCase().includes(m.status.toLowerCase()) ||
                          m.status.toLowerCase().includes(milestone.toLowerCase())
                        )
                      )
                    }
                    
                    return (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', minWidth: '180px', position: 'relative' }}>
                        {/* Milestone Circle */}
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: isCompleted ? '#10b981' : isCurrent ? '#0ea5e9' : '#e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isCompleted || isCurrent ? 'white' : '#6b7280',
                          fontSize: '14px',
                          fontWeight: '600',
                          position: 'relative',
                          zIndex: 2,
                          border: '3px solid white',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          {index + 1}
                        </div>
                        
                        {/* Milestone Label */}
                        <div style={{
                          marginLeft: '12px',
                          minWidth: '180px',
                          maxWidth: '200px'
                        }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: '500',
                            color: isCompleted ? '#10b981' : isCurrent ? '#0ea5e9' : '#6b7280',
                            marginBottom: '2px'
                          }}>
                            {milestone}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: '#6b7280',
                            marginBottom: '4px'
                          }}>
                            {isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Pending'}
                          </div>
                          {/* Always show dates if available from milestoneInfo */}
                          <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px', lineHeight: '1.5', fontWeight: '400' }}>
                            {milestoneInfo?.startDate ? (
                              <div style={{ marginBottom: '2px' }}>
                                <span style={{ fontWeight: '500' }}>Start: </span>
                                <span>{new Date(milestoneInfo.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              </div>
                            ) : null}
                            {milestoneInfo?.endDate ? (
                              <div>
                                <span style={{ fontWeight: '500' }}>End: </span>
                                <span>{new Date(milestoneInfo.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              </div>
                            ) : isCompleted && milestoneInfo?.startDate ? (
                              <div>
                                <span style={{ fontWeight: '500' }}>End: </span>
                                <span>{new Date(milestoneInfo.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              </div>
                            ) : null}
                            {!milestoneInfo?.startDate && !milestoneInfo?.endDate && milestoneInfo?.updatedAt ? (
                              <div>
                                <span style={{ fontWeight: '500' }}>Updated: </span>
                                <span>{new Date(milestoneInfo.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        
                        {/* Connector Line (except for last milestone) */}
                        {index < fixedMilestones.length - 1 && (
                          <div style={{
                            position: 'absolute',
                            left: '60px',
                            top: '50%',
                            width: '80px',
                            height: '2px',
                            backgroundColor: isCompleted ? '#10b981' : '#e5e7eb',
                            transform: 'translateY(-50%)',
                            zIndex: 1
                          }} />
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
              
              {/* Milestone Details */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Current Status: {(jobPosting as any).currentStatus || (jobPosting as any).status || 'Pending FKTK'}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {(() => {
                    const milestoneData = (jobPosting as any).milestones || []
                    const currentStatus = (jobPosting as any).currentStatus || (jobPosting as any).status || 'Pending FKTK'
                    const currentMilestone = milestoneData.find((m: any) => m.status === currentStatus)
                    
                    if (currentMilestone) {
                      return `Started: ${formatDate(currentMilestone.updatedAt)}`
                    }
                    return 'Status: Not Started'
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Applied Candidates */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              Applied Candidates ({appliedCandidates.length})
            </h3>
            {appliedCandidates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {appliedCandidates.map((candidate: any) => {
                  const statusLabel = mapApplicationStatusToUi(
                    (candidate.backendStatus || candidate.status || 'SUBMITTED') as string
                  )
                  const appliedDate = candidate.appliedDate || candidate.appliedAt || candidate.createdAt
                  const skills = candidate.skills || []
                  return (
                    <div key={candidate.id || candidate.candidateId} style={{
                      padding: '16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 
                            onClick={async () => {
                              try {
                                setLoadingCandidate(true)
                                const candidateId = candidate.id || candidate.candidateId
                                if (!candidateId) {
                                  alert('Candidate ID not found')
                                  return
                                }
                                const candidateData = await CandidatesAPI.getById(candidateId)
                                const mappedCandidate = mapApiCandidate(candidateData)
                                setSelectedCandidate(mappedCandidate)
                                setIsCandidateModalOpen(true)
                              } catch (error: any) {
                                console.error('Error loading candidate details:', error)
                                alert(`Failed to load candidate details: ${error.response?.data?.message || error.message}`)
                              } finally {
                                setLoadingCandidate(false)
                              }
                            }}
                            style={{ 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#4f46e5', 
                              margin: '0 0 4px 0',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#4338ca'
                              e.currentTarget.style.textDecoration = 'underline'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#4f46e5'
                              e.currentTarget.style.textDecoration = 'underline'
                            }}
                          >
                            {loadingCandidate ? 'Loading...' : (candidate.fullName || candidate.name || `Candidate ${candidate.id?.substring(0, 6)}`)}
                          </h4>
                          {(candidate.email || candidate.contactInfo?.email) && (
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>
                              {candidate.email || candidate.contactInfo?.email}
                            </p>
                          )}
                          {appliedDate && (
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px 0' }}>
                              Applied: {formatDate(appliedDate)}
                            </p>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {skills.slice(0, 3).map((skill: string, index: number) => (
                              <span key={index} style={{
                                padding: '2px 6px',
                                backgroundColor: '#e0e7ff',
                                color: '#3730a3',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: '500'
                              }}>
                                {skill}
                              </span>
                            ))}
                            {skills.length > 3 && (
                              <span style={{ fontSize: '10px', color: '#6b7280' }}>
                                +{skills.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: '#dcfce7',
                            color: '#166534'
                          }}>
                            {statusLabel}
                          </span>
                          {(statusLabel || '').toString().toLowerCase().startsWith('rejected') && candidate.rejectedDate ? (
                            <div style={{ marginTop: '6px', fontSize: '11px', color: '#b91c1c' }}>
                              Rejected Date: {formatDate(candidate.rejectedDate)}
                            </div>
                          ) : null}
                          {statusLabel === 'Withdrawn' && candidate.withdrawDate ? (
                            <div style={{ marginTop: '6px', fontSize: '11px', color: '#92400e' }}>
                              Withdraw Date: {formatDate(candidate.withdrawDate)}
                            </div>
                          ) : null}
                          {candidate.joinDate ? (
                            <div style={{ marginTop: '6px', fontSize: '11px', color: '#1e40af' }}>
                              Join Date: {formatDate(candidate.joinDate)}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Show interview details for all candidates who have interview data */}
                      {(() => {
                        const hasInterviews = candidate.interviews && Array.isArray(candidate.interviews) && candidate.interviews.length > 0
                        const hasFilledInterviews = hasInterviews && candidate.interviews.some((iv: any) => 
                          iv.interviewer || iv.date || iv.time || iv.results
                        )
                        
                        const candidateKey = candidate.id || candidate.candidateId || ''
                        const isExpanded = expandedInterviewSections.has(candidateKey)
                        
                        // Show interview section if there are filled interviews, regardless of status
                        return hasFilledInterviews ? (
                          <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? '8px' : '0' }}>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                                Interview Details {statusLabel === 'Interviewed' || ['Assessment', 'Offering Creation', 'Pending Feedback', 'Offer Sent', 'Offer Accepted', 'Offer Rejected', 'Medical Checkup Scheduled', 'MCU', 'Contract Sent', 'Contract Signed', 'On Boarding', 'Hired'].includes(statusLabel) ? '(Interview Results)' : ''}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedInterviewSections(prev => {
                                    const newSet = new Set(prev)
                                    if (newSet.has(candidateKey)) {
                                      newSet.delete(candidateKey)
                                    } else {
                                      newSet.add(candidateKey)
                                    }
                                    return newSet
                                  })
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#6b7280',
                                  fontSize: '12px',
                                  padding: '4px 8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>{isExpanded ? '▼' : '▶'}</span>
                                <span>{isExpanded ? 'Minimize' : 'Expand'}</span>
                              </button>
                            </div>
                            
                            {isExpanded && (
                              <>
                            {candidate.interviews.map((interview: any, index: number) => {
                              // Only show interviews that have at least one field filled
                              const hasData = interview.interviewer || interview.date || interview.time || interview.results
                              if (!hasData) return null
                              
                              return (
                                <div key={index} style={{
                                  marginBottom: index < candidate.interviews.length - 1 ? '8px' : '0',
                                  padding: '8px',
                                  backgroundColor: 'white',
                                  borderRadius: '4px',
                                  border: '1px solid #e5e7eb'
                                }}>
                                  <div style={{ fontSize: '11px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                                    Interview {index + 1}
                                  </div>
                                  {interview.interviewer && (
                                    <div style={{ marginBottom: '4px' }}>
                                      <span style={{ fontSize: '10px', fontWeight: '500', color: '#6b7280' }}>Interviewer: </span>
                                      <span style={{ fontSize: '10px', color: '#111827' }}>
                                        {interview.interviewer}
                                      </span>
                                    </div>
                                  )}
                                  {interview.date && (
                                    <div style={{ marginBottom: '4px' }}>
                                      <span style={{ fontSize: '10px', fontWeight: '500', color: '#6b7280' }}>Date: </span>
                                      <span style={{ fontSize: '10px', color: '#111827' }}>
                                        {formatDate(interview.date)}
                                      </span>
                                    </div>
                                  )}
                                  {interview.time && (
                                    <div style={{ marginBottom: '4px' }}>
                                      <span style={{ fontSize: '10px', fontWeight: '500', color: '#6b7280' }}>Time: </span>
                                      <span style={{ fontSize: '10px', color: '#111827' }}>
                                        {interview.time}
                                      </span>
                                    </div>
                                  )}
                                  {interview.results && (
                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                                      <div style={{ fontSize: '10px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>Interview Results:</div>
                                      <div style={{ fontSize: '10px', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {interview.results}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                              </>
                            )}
                          </div>
                        ) : null
                      })()}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                  No candidates have applied to this position yet.
                </p>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Created At</label>
                <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{formatDate(jobPosting.createdAt)}</p>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Last Updated</label>
                <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0 0 0' }}>{formatDate(jobPosting.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
      
      {/* Candidate Detail Modal */}
      <ViewCandidateModal
        isOpen={isCandidateModalOpen}
        onClose={() => {
          setIsCandidateModalOpen(false)
          setSelectedCandidate(null)
        }}
        candidate={selectedCandidate}
      />
    </div>
  )
}
