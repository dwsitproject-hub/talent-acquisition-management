'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useModalEscape } from '@/hooks/useModalEscape'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { MasterOfficeLocationAPI, MasterDivisionAPI, CandidatesAPI, AdminUsersAPI } from '@/lib/api'
import { compressFile, formatFileSize } from '@/utils/fileCompression'
import {
  fptkRequiredFieldHighlightStyle,
  getMissingFptkRequiredKeys,
  type FptkRequiredKey,
} from '@/utils/fptkFormRequired'
import {
  isSuggestedCandidateForPosition,
  parseLanguagesData,
  SUGGESTED_CANDIDATE_MIN_MATCHING_SKILLS,
} from '@/utils/candidateProfileShape'
import { extractCandidateLockFields } from '@/utils/candidateApplicationLock'

interface CreateJobPostingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (jobPostingData: any) => void
  editingJobPosting?: any | null
}

export default function CreateJobPostingModal({ isOpen, onClose, onSave, editingJobPosting }: CreateJobPostingModalProps) {
  const [formData, setFormData] = useState({
    pt: '',
    noFktk: '',
    statusFktk: '',
    division: '',
    section: '',
    hiringManager: '',
    position: '',
    employmentType: '',
    typeGrade: '',
    urgentNormal: '',
    priorityByMonthYear: '',
    jobSpecification: '',
    criteria: '',
    area: '',
    areaDetail: '',
    additionalOrReplacement: '',
    replacementName: '',
    resignReason: '',
    requestDate: '',
    skills: [] as string[],
    yearsOfExperience: '',
    status: 'Pending FKTK',
    remark: ''
  })

  const [loading, setLoading] = useState(false)
  const [showRequiredFieldHighlights, setShowRequiredFieldHighlights] = useState(false)
  const missingRequiredKeys = useMemo(
    () =>
      showRequiredFieldHighlights
        ? getMissingFptkRequiredKeys(formData as unknown as Record<string, unknown>)
        : [],
    [showRequiredFieldHighlights, formData]
  )
  const fInv = (key: FptkRequiredKey) => missingRequiredKeys.includes(key)
  const [divisions, setDivisions] = useState<any[]>([])
  const [officeLocations, setOfficeLocations] = useState<any[]>([])
  const [areaDetails, setAreaDetails] = useState<any[]>([])
  const [suggestedCandidates, setSuggestedCandidates] = useState<any[]>([])
  const [appliedCandidates, setAppliedCandidates] = useState<any[]>([])
  const [fptkFile, setFptkFile] = useState<File | null>(null)
  const [isCompressingFptk, setIsCompressingFptk] = useState(false)
  const [fptkFileError, setFptkFileError] = useState<string>('')
  const [fptkReceiveDate, setFptkReceiveDate] = useState<string>('')
  const [hiringManagerOptions, setHiringManagerOptions] = useState<Array<{firstName: string, lastName: string}>>([])
  const fptkFileInputRef = useRef<HTMLInputElement>(null)

  // Load divisions from Master Division
  useEffect(() => {
    let isMounted = true

    const loadDivisions = async () => {
      try {
        const data = await MasterDivisionAPI.getAll()
        if (isMounted) {
          setDivisions(data || [])
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('masterDivisions', JSON.stringify(data || []))
            } catch (_) {
              // ignore localStorage errors
            }
          }
        }
      } catch (error) {
        console.error('Error loading divisions:', error)
        if (isMounted && typeof window !== 'undefined') {
          try {
            const divisionsData = localStorage.getItem('masterDivisions')
            if (divisionsData) {
              setDivisions(JSON.parse(divisionsData))
            } else {
              setDivisions([])
            }
          } catch (error) {
            console.warn('Could not load divisions from localStorage:', error)
            setDivisions([])
          }
        }
      }
    }

    const loadHiringManagers = async () => {
      try {
        const users = await AdminUsersAPI.list('', 'HIRING_MANAGER')
        if (isMounted) {
          setHiringManagerOptions(users.map((u: any) => ({ firstName: u.firstName, lastName: u.lastName })))
        }
      } catch (error) {
        console.error('Error loading hiring managers:', error)
      }
    }

    loadDivisions()
    loadHiringManagers()

    return () => {
      isMounted = false
    }
  }, [])

  // Load office locations from Master Office Location
  useEffect(() => {
    let isMounted = true

    const loadOfficeLocations = async () => {
      try {
        const data = await MasterOfficeLocationAPI.getAll()
        if (isMounted) {
          setOfficeLocations(data || [])
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('masterOfficeLocations', JSON.stringify(data || []))
            } catch (_) {
              // ignore localStorage errors
            }
          }
        }
      } catch (error) {
        console.error('Error loading office locations:', error)
        if (isMounted && typeof window !== 'undefined') {
          try {
            const officeLocationsData = localStorage.getItem('masterOfficeLocations')
            if (officeLocationsData) {
              setOfficeLocations(JSON.parse(officeLocationsData))
            } else {
              setOfficeLocations([])
            }
          } catch (error) {
            console.warn('Could not load office locations from localStorage:', error)
            setOfficeLocations([])
          }
        }
      }
    }

    loadOfficeLocations()

    return () => {
      isMounted = false
    }
  }, [])

  const ptOptions = useMemo(() => {
    const set = new Set<string>()
    officeLocations.forEach((location: any) => {
      if (location?.pt) {
        set.add(location.pt)
      }
    })
    return Array.from(set)
  }, [officeLocations])

  const areaOptions = useMemo(() => {
    if (!formData.pt) return []
    const set = new Set<string>()
    officeLocations.forEach((location: any) => {
      if (location?.pt === formData.pt && location.area) {
        set.add(location.area)
      }
    })
    return Array.from(set)
  }, [formData.pt, officeLocations])

  const areaDetailOptions = useMemo(() => {
    const set = new Set<string>()
    areaDetails.forEach((detail: any) => {
      if (detail?.areaDetail) {
        set.add(detail.areaDetail)
      }
    })
    return Array.from(set)
  }, [areaDetails])

  const sectionOptions = useMemo(() => {
    if (!formData.division) return []
    const set = new Set<string>()
    divisions.forEach((division: any) => {
      if (division.divisionName === formData.division && division.sectionName) {
        set.add(division.sectionName)
      }
    })
    return Array.from(set)
  }, [formData.division, divisions])

  // Update area details when area or PT changes
  useEffect(() => {
    if (formData.area && officeLocations.length > 0) {
      const filteredAreaDetails = officeLocations.filter((location: any) => 
        location.area === formData.area && (!formData.pt || location.pt === formData.pt)
      )
      setAreaDetails(filteredAreaDetails)
      if (!filteredAreaDetails.some((detail: any) => detail.areaDetail === formData.areaDetail)) {
        setFormData(prev => (
          prev.areaDetail === ''
            ? prev
            : { ...prev, areaDetail: '' }
        ))
      }
    } else {
      setAreaDetails([])
      if (formData.areaDetail) {
        setFormData(prev => ({ ...prev, areaDetail: '' }))
      }
    }
  }, [formData.pt, formData.area, officeLocations])

  // Validate and reset section when division changes
  useEffect(() => {
    if (formData.division && formData.section && sectionOptions.length > 0) {
      if (!sectionOptions.includes(formData.section)) {
        setFormData(prev => ({ ...prev, section: '' }))
      }
    } else if (!formData.division && formData.section) {
      setFormData(prev => ({ ...prev, section: '' }))
    }
  }, [formData.division, sectionOptions])

  const formatDateInput = (value: any) => {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().split('T')[0]
  }

  // Helper function to map API candidate to frontend structure
  const mapApiCandidate = (candidate: any) => {
    if (!candidate) return null
    
    // Parse form data diri
    const parseFormDataDiri = (value: any) => {
      if (!value) return null
      if (typeof value === 'string') {
        try { return JSON.parse(value) } catch { return null }
      }
      return value
    }
    
    const languagesData = parseLanguagesData(candidate)
    const formDataDiri = parseFormDataDiri(candidate.formDataDiri)
    
    const fallbackFullName = formDataDiri?.fullName || candidate.fullName || candidate.name || ''
    const [fallbackFirst, ...fallbackRest] = fallbackFullName ? fallbackFullName.split(' ') : ['']
    const fallbackLast = fallbackRest.join(' ')
    
    // Get name from multiple sources
    const firstName = candidate.user?.firstName
      || candidate.personalInfo?.firstName
      || formDataDiri?.firstName
      || fallbackFirst
      || candidate.firstName
      || ''
    const lastName = candidate.user?.lastName
      || candidate.personalInfo?.lastName
      || formDataDiri?.lastName
      || fallbackLast
      || candidate.lastName
      || ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || fallbackFullName || 'Unknown Candidate'
    
    // Get email
    const email = candidate.user?.email
      || candidate.contactInfo?.email
      || formDataDiri?.email
      || candidate.email
      || ''
    
    // Get skills
    const skills = candidate.skills || candidate.professionalInfo?.skills || []
    
    // Get years of experience
    const yearsOfExperience = Number(candidate.yearsOfExperience ?? candidate.professionalInfo?.experience ?? 0) || 0
    
    return {
      id: candidate.id,
      fullName,
      name: fullName,
      email,
      yearsOfExperience,
      experience: yearsOfExperience,
      personalInfo: {
        firstName,
        lastName,
        dateOfBirth: candidate.dateOfBirth ? new Date(candidate.dateOfBirth).toISOString().split('T')[0] : '',
        gender: candidate.gender || '',
        nationality: candidate.nationality || '',
        maritalStatus: candidate.maritalStatus || '',
      },
      contactInfo: {
        email,
        phone: candidate.user?.phoneNumber || candidate.phoneNumber || '',
        address: candidate.currentAddress || '',
        city: candidate.city || '',
        state: candidate.state || '',
        country: candidate.country || '',
        zipCode: candidate.zipCode || '',
      },
      professionalInfo: {
        currentPosition: candidate.currentJobTitle || candidate.currentPosition || '',
        currentCompany: candidate.currentCompany || '',
        experience: yearsOfExperience,
        skills,
        education: candidate.educations || [],
        workHistory: candidate.workExperiences || [],
        certifications: candidate.certifications || [],
      },
      skills,
      user: candidate.user,
      division: candidate.division,
      divisionList: candidate.divisionList,
      languages: candidate.languages,
      ...extractCandidateLockFields(candidate),
    }
  }

  // Generate suggested candidates when skills or division changes
  useEffect(() => {
    if (formData.division) {
      const loadSuggestedCandidates = async () => {
        try {
          console.log('[CreateJobPostingModal] Loading suggested candidates for division:', formData.division)
          const forFptkId = editingJobPosting?.id ? String(editingJobPosting.id) : undefined
          const response = await CandidatesAPI.getAll(
            forFptkId ? { forFptkId } : {},
            { page: 1, limit: 100 }
          )
          const rawCandidates = response.data || []
          console.log('[CreateJobPostingModal] Loaded candidates:', rawCandidates.length)
          
          // Map candidates to frontend structure
          const candidates = rawCandidates.map(mapApiCandidate).filter((c: any) => c !== null)
          
          const suggested = candidates.filter((candidate: any) =>
            isSuggestedCandidateForPosition(
              candidate,
              formData.division,
              formData.skills,
              new Set(
                appliedCandidates.map((applied: any) => applied.id || applied.candidateId).filter(Boolean)
              )
            )
          ).slice(0, 10)
          
          console.log('[CreateJobPostingModal] Suggested candidates:', suggested.length)
          setSuggestedCandidates(suggested)
        } catch (error) {
          console.error('Error loading suggested candidates:', error)
          setSuggestedCandidates([])
        }
      }
      
      loadSuggestedCandidates()
    } else {
      setSuggestedCandidates([])
    }
  }, [formData.skills, formData.division, appliedCandidates, editingJobPosting?.id])

  // Populate form when editing
  useEffect(() => {
    if (editingJobPosting && isOpen) {
      setShowRequiredFieldHighlights(false)
      setFormData({
        pt: editingJobPosting.pt || '',
        noFktk: editingJobPosting.noFktk || '',
        statusFktk: editingJobPosting.statusFktk || '',
        division: editingJobPosting.department || '',
        section: editingJobPosting.section || '',
        hiringManager: editingJobPosting.hiringManager || '',
        position: editingJobPosting.title || '',
        employmentType: (() => {
          // First check the mapped type field
          if (editingJobPosting.type === 'contract') return 'Contract'
          if (editingJobPosting.type === 'full-time') return 'Full Time Employee'
          if (editingJobPosting.type === 'internship') return 'Internship'
          // Fallback: check if raw employmentType exists and map old values
          const rawEmploymentType = (editingJobPosting as any).employmentType || ''
          const normalized = rawEmploymentType.toString().trim().toLowerCase()
          if (normalized === 'kontrak' || normalized === 'contract') return 'Contract'
          if (normalized === 'probation' || normalized === 'full-time' || normalized === 'fulltime') return 'Full Time Employee'
          if (normalized === 'internship') return 'Internship'
          // Return empty string if no match
          return ''
        })(),
        typeGrade: editingJobPosting.level || '',
        urgentNormal: editingJobPosting.priority === 'urgent' ? 'P0' : 
                      editingJobPosting.priority === 'high' ? 'P1' : 
                      editingJobPosting.priority === 'medium' ? 'P2' : 
                      (editingJobPosting as any).urgentNormal || '',
        priorityByMonthYear: editingJobPosting.deadline ? editingJobPosting.deadline.substring(0, 7) : '',
        jobSpecification: editingJobPosting.description || '',
        criteria: editingJobPosting.criteria || '',
        area: editingJobPosting.location === 'Site' ? 'Site' : editingJobPosting.location === 'Head Office' ? 'HO' : '',
        areaDetail: editingJobPosting.areaDetail || '',
        additionalOrReplacement: editingJobPosting.additionalOrReplacement || '',
        replacementName: editingJobPosting.replacementName || '',
        resignReason: editingJobPosting.resignReason || '',
        requestDate: formatDateInput(editingJobPosting.requestDate),
        skills: editingJobPosting.skills || [],
        yearsOfExperience: editingJobPosting.yearsOfExperience || '',
        status: editingJobPosting.currentStatus || editingJobPosting.status || 'Pending FKTK',
        remark: editingJobPosting.remark || ''
      })
    } else if (isOpen) {
      setShowRequiredFieldHighlights(false)
      // Reset form for new open position
      setFormData({
        pt: '',
        noFktk: '',
        statusFktk: '',
        division: '',
        section: '',
        hiringManager: '',
        position: '',
        employmentType: '',
        typeGrade: '',
        urgentNormal: '',
        priorityByMonthYear: '',
        jobSpecification: '',
        criteria: '',
        area: '',
        areaDetail: '',
        additionalOrReplacement: '',
        replacementName: '',
        resignReason: '',
        requestDate: '',
        skills: [],
        yearsOfExperience: '',
        status: 'Pending FKTK',
        remark: ''
      })
    }
  }, [editingJobPosting, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const missing = getMissingFptkRequiredKeys(formData as unknown as Record<string, unknown>)
    if (missing.length > 0) {
      setShowRequiredFieldHighlights(true)
      setLoading(false)
      return
    }
    setShowRequiredFieldHighlights(false)

    // Include applied candidates and area detail in the job posting data
    const jobPostingData = {
      ...formData,
      appliedCandidates,
      areaDetail: formData.areaDetail
    }

    // Include FPTK file and receive date in the payload
    const payload = {
      ...jobPostingData,
      fptkFile: fptkFile,
      fptkReceiveDate: fptkReceiveDate || (formData.statusFktk === 'Received' ? new Date().toISOString().split('T')[0] : '')
    }
    
    onSave(payload)
    setLoading(false)
    onClose()
  }

  const handleFptkFileUpload = async (file: File) => {
    const MAX_SIZE = 2 * 1024 * 1024 // 2MB
    setIsCompressingFptk(true)
    setFptkFileError('')

    try {
      // Check if it's a PDF or image
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)

      // For PDFs, reject if larger than 2MB (can't compress client-side)
      if (isPDF && file.size > MAX_SIZE) {
        throw new Error(`PDF file size (${formatFileSize(file.size)}) exceeds 2MB. Please compress the PDF using an online tool before uploading.`)
      }

      // For images, allow up to 10MB for compression
      if (isImage && file.size > MAX_SIZE * 5) {
        throw new Error(`Image file size (${formatFileSize(file.size)}) is too large. Maximum allowed is 2MB after compression.`)
      }

      // Compress if needed (for images)
      let processedFile = file
      if (file.size > MAX_SIZE && isImage) {
        try {
          processedFile = await compressFile(file)
        } catch (compressionError: any) {
          throw new Error(compressionError.message || 'Failed to compress file.')
        }
      }

      // Final size check
      if (processedFile.size > MAX_SIZE) {
        throw new Error(`File size (${formatFileSize(processedFile.size)}) exceeds 2MB. Please use a smaller file.`)
      }

      setFptkFile(processedFile)
      // Auto-set statusFktk to "Received" and capture receive date when file is uploaded
      if (formData.statusFktk !== 'Received') {
        setFormData(prev => ({ ...prev, statusFktk: 'Received' }))
      }
      setFptkReceiveDate(new Date().toISOString().split('T')[0])
    } catch (error: any) {
      setFptkFileError(error.message || 'Failed to process file')
    } finally {
      setIsCompressingFptk(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Capture FPTK Receive Date when statusFktk changes to "Received"
    if (name === 'statusFktk' && value === 'Received' && !fptkReceiveDate) {
      setFptkReceiveDate(new Date().toISOString().split('T')[0])
    }

    if (name === 'pt') {
      setFormData(prev => ({
        ...prev,
        pt: value,
        area: '',
        areaDetail: ''
      }))
      return
    }

    if (name === 'area') {
      setFormData(prev => ({
        ...prev,
        area: value,
        areaDetail: ''
      }))
      return
    }

    if (name === 'division') {
      setFormData(prev => ({
        ...prev,
        division: value,
        section: '' // Reset section when division changes
      }))
      return
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAddSuggestedCandidate = (candidate: any) => {
    const newAppliedCandidate = {
      ...candidate,
       fullName:
         candidate.fullName ||
         candidate.name ||
         [candidate.personalInfo?.firstName, candidate.personalInfo?.lastName].filter(Boolean).join(' '),
       name:
         candidate.name ||
         candidate.fullName ||
         [candidate.personalInfo?.firstName, candidate.personalInfo?.lastName].filter(Boolean).join(' '),
       email: candidate.email || candidate.contactInfo?.email || '',
      status: 'Applied',
      appliedDate: new Date().toISOString().split('T')[0],
      jobPostingId: 'new'
    }
    
    setAppliedCandidates(prev => [...prev, newAppliedCandidate])
    setSuggestedCandidates(prev => prev.filter(c => c.id !== candidate.id))
  }

  const handleClose = () => {
    setShowRequiredFieldHighlights(false)
    setFormData({
      pt: '',
      noFktk: '',
      statusFktk: '',
      division: '',
      section: '',
      hiringManager: '',
      position: '',
      employmentType: '',
      typeGrade: '',
      urgentNormal: '',
      priorityByMonthYear: '',
      jobSpecification: '',
      criteria: '',
      area: '',
      areaDetail: '',
      additionalOrReplacement: '',
      replacementName: '',
      resignReason: '',
      requestDate: '',
      skills: [] as string[],
      yearsOfExperience: '',
      status: 'Pending FKTK',
      remark: ''
    })
    onClose()
  }

  useModalEscape(isOpen, onClose)

  if (!isOpen) return null

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
        maxWidth: '800px',
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
            {editingJobPosting ? 'Edit Position' : 'Create New Position'}
          </h2>
          <button
            onClick={handleClose}
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* PT */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('pt') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                PT *
              </label>
              <select
                name="pt"
                value={formData.pt}
                onChange={handleInputChange}
                required
                aria-invalid={fInv('pt')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  ...fptkRequiredFieldHighlightStyle(fInv('pt'))
                }}
              >
                <option value="">Select PT</option>
                {ptOptions.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
                {formData.pt && !ptOptions.includes(formData.pt) && (
                  <option value={formData.pt}>{formData.pt}</option>
                )}
              </select>
            </div>

            {/* No FKTK */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                No FKTK
              </label>
              <input
                type="text"
                name="noFktk"
                value={formData.noFktk}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Status FKTK */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Status FKTK
              </label>
              <select
                name="statusFktk"
                value={formData.statusFktk}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Select Status</option>
                <option value="Pending">Pending</option>
                <option value="Received">Received</option>
              </select>
            </div>

            {/* FPTK File Upload */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                FPTK File Upload
              </label>
              <input
                ref={fptkFileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleFptkFileUpload(file)
                  }
                }}
                style={{ display: 'none' }}
              />
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '6px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: '#f9fafb',
                cursor: isCompressingFptk ? 'not-allowed' : 'pointer',
                opacity: isCompressingFptk ? 0.6 : 1
              }}
              onClick={() => !isCompressingFptk && fptkFileInputRef.current?.click()}
              >
                {isCompressingFptk ? (
                  <div>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>Compressing file...</p>
                  </div>
                ) : fptkFile ? (
                  <div>
                    <p style={{ fontSize: '14px', color: '#10b981', fontWeight: '500' }}>✓ {fptkFile.name}</p>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      {formatFileSize(fptkFile.size)}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFptkFile(null)
                        if (fptkFileInputRef.current) {
                          fptkFileInputRef.current.value = ''
                        }
                      }}
                      style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        color: '#ef4444',
                        textDecoration: 'underline'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '14px', color: '#6b7280' }}>Click to upload FPTK file</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                      PDF, Images up to 2MB (auto-compressed if larger)
                    </p>
                  </div>
                )}
              </div>
              {fptkFileError && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{fptkFileError}</p>
              )}
              {fptkReceiveDate && (
                <p style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                  FPTK Receive Date: {new Date(fptkReceiveDate).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Division */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('division') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Division *
              </label>
              <select
                name="division"
                value={formData.division}
                onChange={handleInputChange}
                required
                aria-invalid={fInv('division')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  ...fptkRequiredFieldHighlightStyle(fInv('division'))
                }}
              >
                <option value="">Select Division</option>
                {Array.from(new Set(divisions.map((d: any) => d.divisionName))).map((divisionName) => (
                  <option key={divisionName} value={divisionName}>
                    {divisionName}
                  </option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('section') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Section *
              </label>
              <select
                name="section"
                value={formData.section}
                onChange={handleInputChange}
                required
                aria-invalid={fInv('section')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  ...fptkRequiredFieldHighlightStyle(fInv('section'))
                }}
              >
                <option value="">Select Section</option>
                {sectionOptions.map((section, index) => (
                  <option key={index} value={section}>
                    {section}
                  </option>
                ))}
                {formData.section && !sectionOptions.includes(formData.section) && (
                  <option value={formData.section}>{formData.section}</option>
                )}
              </select>
            </div>

            {/* Hiring Manager */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('hiringManager') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Hiring Manager *
              </label>
              <select
                name="hiringManager"
                value={formData.hiringManager}
                onChange={handleInputChange}
                required
                aria-invalid={fInv('hiringManager')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  ...fptkRequiredFieldHighlightStyle(fInv('hiringManager'))
                }}
              >
                <option value="">Select Hiring Manager</option>
                {hiringManagerOptions.map((user, index) => {
                  const fullName = `${user.firstName} ${user.lastName}`.trim()
                  return (
                    <option key={index} value={fullName}>
                      {fullName}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Position */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('position') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Position *
              </label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleInputChange}
                required
                aria-invalid={fInv('position')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  ...fptkRequiredFieldHighlightStyle(fInv('position'))
                }}
              />
            </div>

            {/* Employment Type */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('employmentType') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Employment Type *
              </label>
              <select
                name="employmentType"
                value={formData.employmentType}
                onChange={handleInputChange}
                required
                aria-invalid={fInv('employmentType')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  ...fptkRequiredFieldHighlightStyle(fInv('employmentType'))
                }}
              >
                <option value="">Select Employment Type</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
                <option value="Full Time Employee">Full Time Employee</option>
              </select>
            </div>

            {/* Type Grade */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Type Grade
              </label>
              <input
                type="text"
                name="typeGrade"
                value={formData.typeGrade}
                onChange={handleInputChange}
                maxLength={2}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>


            {/* Priority */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Priority
              </label>
              <select
                name="urgentNormal"
                value={formData.urgentNormal}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Select Priority</option>
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
              </select>
            </div>

            {/* Priority by Month-Year */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Priority by Month-Year
              </label>
              <input
                type="month"
                name="priorityByMonthYear"
                value={formData.priorityByMonthYear}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Criteria */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('criteria') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Criteria *
              </label>
              <select
                name="criteria"
                value={formData.criteria}
                onChange={handleInputChange}
                required
                aria-invalid={fInv('criteria')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  ...fptkRequiredFieldHighlightStyle(fInv('criteria'))
                }}
              >
                <option value="">Select Criteria</option>
                <option value="Staff">Staff</option>
                <option value="Non Staff">Non Staff</option>
              </select>
            </div>

            {/* Area */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('area') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Area *
              </label>
              <select
                name="area"
                value={formData.area}
                onChange={handleInputChange}
                required
                disabled={!formData.pt}
                aria-invalid={fInv('area')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: formData.pt ? 'white' : '#f3f4f6',
                  ...fptkRequiredFieldHighlightStyle(fInv('area'))
                }}
              >
                <option value="">{formData.pt ? 'Select Area' : 'Select PT first'}</option>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
                {formData.area && !areaOptions.includes(formData.area) && (
                  <option value={formData.area}>{formData.area}</option>
                )}
              </select>
            </div>

            {/* Area Detail */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('areaDetail') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Area Detail *
              </label>
              <select
                name="areaDetail"
                value={formData.areaDetail}
                onChange={handleInputChange}
                required
                disabled={!formData.area}
                aria-invalid={fInv('areaDetail')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: formData.area ? 'white' : '#f3f4f6',
                  ...fptkRequiredFieldHighlightStyle(fInv('areaDetail'))
                }}
              >
                <option value="">{formData.area ? 'Select Area Detail' : 'Select Area first'}</option>
                {areaDetailOptions.map((detail) => (
                  <option key={detail} value={detail}>
                    {detail}
                  </option>
                ))}
                {formData.areaDetail && !areaDetailOptions.includes(formData.areaDetail) && (
                  <option value={formData.areaDetail}>{formData.areaDetail}</option>
                )}
              </select>
            </div>

            {/* Additional or Replacement */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('additionalOrReplacement') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Additional or Replacement *
              </label>
              <select
                name="additionalOrReplacement"
                value={formData.additionalOrReplacement}
                onChange={handleInputChange}
                required
                aria-invalid={fInv('additionalOrReplacement')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  ...fptkRequiredFieldHighlightStyle(fInv('additionalOrReplacement'))
                }}
              >
                <option value="">Select Type</option>
                <option value="Additional">Additional</option>
                <option value="Replacement">Replacement</option>
              </select>
            </div>

            {/* Replacement Name */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Replacement Name
              </label>
              <input
                type="text"
                name="replacementName"
                value={formData.replacementName}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Resign Reason */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Resign Reason
              </label>
              <input
                type="text"
                name="resignReason"
                value={formData.resignReason}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>


            {/* Request Date */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: fInv('requestDate') ? '#b91c1c' : '#374151',
                marginBottom: '6px'
              }}>
                Request Date *
              </label>
              <input
                type="date"
                name="requestDate"
                value={formData.requestDate}
                onChange={handleInputChange}
                required
                aria-invalid={fInv('requestDate')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  ...fptkRequiredFieldHighlightStyle(fInv('requestDate'))
                }}
              />
            </div>

            {/* Current Status */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Current Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="Open">Open</option>
                <option value="Pending FKTK">Pending FKTK</option>
                <option value="Re-Open">Re-Open</option>
                <option value="Cancel">Cancel</option>
                <option value="Internal Movement">Internal Movement</option>
                <option value="Close">Close</option>
              </select>
            </div>
          </div>

          {/* Skills - Full Width */}
          <div style={{ marginTop: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Skills (for AI candidate matching)
            </label>
            <div style={{ marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Type a skill and press Enter"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const target = e.target as HTMLInputElement
                    const skill = target.value.trim()
                    if (skill && !formData.skills.includes(skill)) {
                      setFormData(prev => ({
                        ...prev,
                        skills: [...prev.skills, skill]
                      }))
                      target.value = ''
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {formData.skills.map((skill, index) => (
                <span
                  key={index}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        skills: prev.skills.filter((_, i) => i !== index)
                      }))
                    }}
                    style={{
                      marginLeft: '4px',
                      background: 'none',
                      border: 'none',
                      color: '#3730a3',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Suggested Candidates */}
          {suggestedCandidates.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Suggested Candidates ({suggestedCandidates.length})
              </h4>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                Candidates with matching division and at least {SUGGESTED_CANDIDATE_MIN_MATCHING_SKILLS} matching required skills
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {suggestedCandidates.map((candidate) => (
                  <div key={candidate.id} style={{
                    padding: '16px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
                          {candidate.fullName || [candidate.personalInfo?.firstName, candidate.personalInfo?.lastName].filter(Boolean).join(' ') || 'Unknown Candidate'}
                        </h5>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>
                          {candidate.email || candidate.contactInfo?.email || 'No email available'}
                        </p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px 0' }}>
                          Experience: {candidate.yearsOfExperience || candidate.professionalInfo?.experience || 0} years
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(candidate.skills || candidate.professionalInfo?.skills || []).map((skill: string, index: number) => (
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
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddSuggestedCandidate(candidate)}
                        style={{
                          padding: '6px 12px',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          color: 'white',
                          backgroundColor: '#10b981',
                          cursor: 'pointer'
                        }}
                      >
                        Add to Applied
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applied Candidates */}
          {appliedCandidates.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Applied Candidates ({appliedCandidates.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {appliedCandidates.map((candidate) => (
                  <div key={candidate.id} style={{
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {candidate.fullName ||
                          candidate.name ||
                          [candidate.personalInfo?.firstName, candidate.personalInfo?.lastName]
                            .filter(Boolean)
                            .join(' ') ||
                          `Candidate ${candidate.id.substring(0, 6)}`}
                      </span>
                      {(candidate.email || candidate.contactInfo?.email) && (
                        <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                          ({candidate.email || candidate.contactInfo?.email})
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor: '#dcfce7',
                        color: '#166534',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      {candidate.status || 'Applied'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Years of Experience */}
          <div style={{ marginTop: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Years of Experience (for AI candidate matching)
            </label>
            <input
              type="number"
              name="yearsOfExperience"
              value={formData.yearsOfExperience}
              onChange={handleInputChange}
              min="0"
              placeholder="e.g., 3"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Job Specification and Qualification - Full Width */}
          <div style={{ marginTop: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: fInv('jobSpecification') ? '#b91c1c' : '#374151',
              marginBottom: '6px'
            }}>
              Job Specification and Qualification *
            </label>
            <textarea
              name="jobSpecification"
              value={formData.jobSpecification}
              onChange={handleInputChange}
              rows={4}
              placeholder="Enter job specification and qualification requirements..."
              aria-invalid={fInv('jobSpecification')}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                ...fptkRequiredFieldHighlightStyle(fInv('jobSpecification'))
              }}
            />
          </div>

          {/* Remark - Full Width */}
          <div style={{ marginTop: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Remark
            </label>
            <textarea
              name="remark"
              value={formData.remark}
              onChange={handleInputChange}
              rows={3}
              maxLength={2048}
              placeholder="Enter any additional notes (max 2048 characters)"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb',
            marginTop: '20px'
          }}>
            <button
              type="button"
              onClick={handleClose}
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                backgroundColor: loading ? '#9ca3af' : '#4f46e5',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (editingJobPosting ? 'Updating...' : 'Creating...') : (editingJobPosting ? 'Update Position' : 'Create Position')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
