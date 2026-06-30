'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useModalEscape } from '@/hooks/useModalEscape'
import { useAuth } from '@/contexts/AuthContext'
import { XMarkIcon, CloudArrowUpIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { MasterDivisionAPI } from '@/lib/api'
import {
  loadSelectablePositionOptions,
  filterPositionOptionsByDivisions,
  filterPositionOptionsByTaSiteScope,
  parseScopeValues,
  isTaSiteAuthUser,
  prunePositionAppliedFor,
  resolvePositionAppliedFptkIds,
  type PositionOption,
} from '@/lib/fptkPositionOptions'
import PositionAppliedForField, { type PositionPickerMeta } from '@/components/PositionAppliedForField'
import { compressFile, formatFileSize } from '@/utils/fileCompression'

interface FileSelection {
  cvFile: File | null
  formDataFile: File | null
  additionalFiles?: File[]
}

interface EnhancedAddCandidateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (candidateData: any, files: FileSelection) => void | Promise<void>
}

function createInitialFormData() {
  return {
    fullName: '',
    position: '',
    placeOfBirth: '',
    dateOfBirth: '',
    gender: '',
    ethnicity: '',
    maritalStatus: '',
    height: '',
    weight: '',
    idNumber: '',
    taxNumber: '',
    bpjsNumber: '',
    healthStatus: '',
    drivingLicense: '',
    bloodType: '',
    currentAddress: '',
    permanentAddress: '',
    phone: '',
    email: '',
    yearsOfExperience: '',
    source: '',
    sourceDetail: '',
    skills: [] as string[],
    division: [] as string[],
    positionAppliedFor: [] as string[],
    cvFile: null as File | null,
    formDataFile: null as File | null,
    additionalFiles: [] as File[],
  }
}

export default function EnhancedAddCandidateModal({ isOpen, onClose, onSave }: EnhancedAddCandidateModalProps) {
  const { user } = useAuth()
  const isTaSiteUser = isTaSiteAuthUser(user)
  const taSitePts = useMemo(() => parseScopeValues((user as any)?.pt), [user])
  const taSiteAreaDetails = useMemo(() => parseScopeValues((user as any)?.areaDetail), [user])
  const taSiteScopeReady = taSitePts.length > 0 && taSiteAreaDetails.length > 0

  const [activeTab, setActiveTab] = useState('personal')
  const [formData, setFormData] = useState(createInitialFormData)

  const [newSkill, setNewSkill] = useState('')
  const [activeJobPostings, setActiveJobPostings] = useState<PositionOption[]>([])
  const [positionPickerMeta, setPositionPickerMeta] = useState<PositionPickerMeta | null>(null)
  const [divisions, setDivisions] = useState<any[]>([])
  const [loadingDivisions, setLoadingDivisions] = useState(false)
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [fileErrors, setFileErrors] = useState<{ [key: string]: string }>({})

  const uniqueDivisionNames = useMemo(
    () =>
      [...new Set(
        divisions
          .map((d) => d?.divisionName?.trim())
          .filter((name): name is string => !!name)
      )].sort((a, b) => a.localeCompare(b)),
    [divisions]
  )

  const positionOptionsForPicker = useMemo(() => {
    if (isTaSiteUser) {
      return filterPositionOptionsByTaSiteScope(activeJobPostings, taSitePts, taSiteAreaDetails)
    }
    return filterPositionOptionsByDivisions(activeJobPostings, formData.division)
  }, [activeJobPostings, formData.division, isTaSiteUser, taSitePts, taSiteAreaDetails])

  const filteredPickerMeta = useMemo(
    () =>
      positionPickerMeta
        ? {
            ...positionPickerMeta,
            selectableCount: positionOptionsForPicker.length,
          }
        : null,
    [positionOptionsForPicker, positionPickerMeta]
  )

  const divisionSelected = isTaSiteUser ? taSiteScopeReady : formData.division.length > 0
  const taSitePickerNotReadyMessage =
    'Your account has no PT or Area Detail assigned. Contact an administrator.'
  const taSiteNoOptionsMessage = 'No open positions for your PT / Area Detail scope'
  const [isCompressing, setIsCompressing] = useState(false)

  const cvInputRef = useRef<HTMLInputElement>(null)
  const additionalFilesInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setFormData(createInitialFormData())
    setNewSkill('')
    setActiveTab('personal')
    setFileErrors({})
    if (cvInputRef.current) cvInputRef.current.value = ''
    if (additionalFilesInputRef.current) additionalFilesInputRef.current.value = ''
  }

  console.log('[EnhancedAddCandidateModal] Active job postings state:', activeJobPostings)
  console.log('[EnhancedAddCandidateModal] Divisions state:', divisions)

  // Reset form and load master data each time the modal opens
  useEffect(() => {
    if (!isOpen) {
      return
    }

    resetForm()

    // Load divisions from Master Division API
    const loadDivisions = async () => {
      setLoadingDivisions(true)
      try {
        const divisionsData = await MasterDivisionAPI.getAll()
        // MasterDivisionAPI.getAll() returns res.data.data which is already an array
        let divisionsArray = []
        if (Array.isArray(divisionsData)) {
          divisionsArray = divisionsData
        } else if (divisionsData && Array.isArray(divisionsData.data)) {
          divisionsArray = divisionsData.data
        } else if (divisionsData && divisionsData.success && Array.isArray(divisionsData.data)) {
          divisionsArray = divisionsData.data
        }
        setDivisions(divisionsArray)
      } catch (error: any) {
        setDivisions([])
      } finally {
        setLoadingDivisions(false)
      }
    }
    
    const loadJobPostings = async () => {
      setLoadingPositions(true)
      try {
        const result = await loadSelectablePositionOptions()
        setActiveJobPostings(result.options)
        setPositionPickerMeta({
          totalFetched: result.totalFetched,
          selectableCount: result.selectableCount,
          excludedByStatusCount: result.excludedByStatusCount,
        })
      } catch (error) {
        console.error('[EnhancedAddCandidateModal] Error loading job postings:', error)
        setActiveJobPostings([])
        setPositionPickerMeta(null)
      } finally {
        setLoadingPositions(false)
      }
    }
    
    // Load both in parallel
    loadDivisions()
    loadJobPostings()
  }, [isOpen])

  const tabs = [
    { id: 'personal', name: 'Personal Info', icon: '👤' },
    { id: 'files', name: 'Files', icon: '📁' }
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }))
      setNewSkill('')
    }
  }

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }))
  }

  const handleToggleDivision = (divisionName: string) => {
    setFormData((prev) => {
      const nextDivision = prev.division.includes(divisionName)
        ? prev.division.filter((d) => d !== divisionName)
        : [...prev.division, divisionName]

      return {
        ...prev,
        division: nextDivision,
        positionAppliedFor: prunePositionAppliedFor(
          prev.positionAppliedFor,
          activeJobPostings,
          nextDivision
        ),
      }
    })
  }

  const handleFileUpload = async (file: File, type: 'cv' | 'additional') => {
    try {
      setIsCompressing(true)
      setFileErrors(prev => ({ ...(prev || {}), [type]: '' }))

      // Validate file size (before compression)
      const MAX_SIZE = 2 * 1024 * 1024 // 2MB
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.name)
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      
      // For images, try to compress even if larger than 2MB (allow up to 10MB for compression to work)
      // For non-image files (PDFs, DOCs, etc.), reject if larger than 2MB (can't compress client-side)
      if (!isImage && file.size > MAX_SIZE) {
        throw new Error(`File size (${formatFileSize(file.size)}) exceeds the maximum allowed size of 2MB. ${isPDF ? 'PDF files cannot be compressed automatically. Please compress the PDF file using an online tool (e.g., SmallPDF, ILovePDF) or PDF software before uploading.' : 'Please use a smaller file.'}`)
      }

      // For images, allow up to 10MB for compression to work
      if (isImage && file.size > MAX_SIZE * 5) {
        throw new Error(`Image file size (${formatFileSize(file.size)}) is too large. Maximum allowed is 2MB after compression. Please use a smaller image.`)
      }

      // Compress file if needed (works for images)
      let processedFile = file
      if (file.size > MAX_SIZE) {
        try {
          processedFile = await compressFile(file)
        } catch (compressionError: any) {
          throw new Error(compressionError.message || 'Failed to compress file. Please use a smaller file.')
        }
      }

      // Final size check after compression
      if (processedFile.size > MAX_SIZE) {
        if (isImage) {
          throw new Error(`Image file size after compression (${formatFileSize(processedFile.size)}) still exceeds 2MB. Please use a smaller image.`)
        } else {
          throw new Error(`File size (${formatFileSize(processedFile.size)}) exceeds the maximum allowed size of 2MB. Please use a smaller file.`)
        }
      }

      if (type === 'cv') {
        setFormData(prev => ({ ...prev, cvFile: processedFile }))
      } else if (type === 'additional') {
        // Check if we've reached the maximum of 5 files
        setFormData(prev => {
          if (prev.additionalFiles.length >= 5) {
            throw new Error('Maximum of 5 additional files allowed. Please remove a file before adding a new one.')
          }
          return { ...prev, additionalFiles: [...prev.additionalFiles, processedFile] }
        })
      }
    } catch (error: any) {
      setFileErrors(prev => ({ ...(prev || {}), [type]: error.message || 'Failed to process file' }))
    } finally {
      setIsCompressing(false)
    }
  }

  const removeAdditionalFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalFiles: prev.additionalFiles.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate CV is uploaded
    if (!formData.cvFile) {
      setFileErrors(prev => ({ ...prev, cv: 'CV document is required. Please upload a CV file (max 2MB).' }))
      setActiveTab('files')
      return
    }

    // Clear any previous errors
    setFileErrors({})
    console.log('Saving enhanced candidate data:', formData)
    await Promise.resolve(
      onSave(
        {
          ...formData,
          positionAppliedFptkIds: resolvePositionAppliedFptkIds(
            formData.positionAppliedFor,
            activeJobPostings
          ),
        },
        {
        cvFile: formData.cvFile,
        formDataFile: formData.formDataFile,
        additionalFiles: formData.additionalFiles
      })
    )
    onClose()
  }

  useModalEscape(isOpen, onClose)

  if (!isOpen) {
    console.log('EnhancedAddCandidateModal: not open, returning null')
    return null
  }

  console.log('EnhancedAddCandidateModal: rendering modal')

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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
          justifyContent: 'center'
        }}
        onClick={onClose}
      >
      <div 
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          minWidth: '600px',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Add New Candidate</h3>
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
                      color: activeTab === tab.id ? '#4F46E5' : '#6B7280',
                      background: 'none',
                      border: 'none',
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
              {activeTab === 'personal' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Division
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '60px', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', backgroundColor: '#fff' }}>
                      {formData.division.length === 0 ? (
                        <span style={{ fontSize: '14px', color: '#9CA3AF', fontStyle: 'italic' }}>No divisions selected</span>
                      ) : (
                        formData.division.map((div) => (
                          <span
                            key={div}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 12px',
                              backgroundColor: '#EEF2FF',
                              color: '#4F46E5',
                              borderRadius: '16px',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}
                          >
                            {div}
                            <button
                              type="button"
                              onClick={() => handleToggleDivision(div)}
                              style={{
                                marginLeft: '8px',
                                background: 'none',
                                border: 'none',
                                color: '#4F46E5',
                                cursor: 'pointer',
                                fontSize: '16px',
                                lineHeight: 1
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleToggleDivision(e.target.value)
                            e.target.value = ''
                          }
                        }}
                        disabled={loadingDivisions}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          fontSize: '14px',
                          outline: 'none',
                          opacity: loadingDivisions ? 0.6 : 1,
                          cursor: loadingDivisions ? 'wait' : 'pointer'
                        }}
                      >
                        <option value="">
                          {loadingDivisions ? 'Loading divisions...' : 'Add Division'}
                        </option>
                        {!loadingDivisions && uniqueDivisionNames.length > 0 ? (
                          uniqueDivisionNames
                            .filter((name) => !formData.division.includes(name))
                            .map((divisionName) => (
                              <option key={divisionName} value={divisionName}>
                                {divisionName}
                              </option>
                            ))
                        ) : !loadingDivisions ? (
                          <option value="" disabled>No divisions available. Please add divisions in Master Division page.</option>
                        ) : null}
                      </select>
                    </div>
                  </div>
                  <PositionAppliedForField
                    selected={formData.positionAppliedFor}
                    options={positionOptionsForPicker}
                    loading={loadingPositions}
                    meta={filteredPickerMeta}
                    divisionSelected={divisionSelected}
                    disabled={!divisionSelected}
                    pickerNotReadyMessage={isTaSiteUser ? taSitePickerNotReadyMessage : undefined}
                    noOptionsMessage={isTaSiteUser ? taSiteNoOptionsMessage : undefined}
                    onChange={(positionAppliedFor) =>
                      setFormData((prev) => {
                        const next: typeof prev = { ...prev, positionAppliedFor }
                        if (isTaSiteUser) {
                          const divisionsFromPositions = positionAppliedFor
                            .map((title) => activeJobPostings.find((opt) => opt.title === title)?.division?.trim())
                            .filter((div): div is string => !!div)
                          next.division = [...new Set(divisionsFromPositions)]
                        }
                        return next
                      })
                    }
                  />
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Place of Birth
                    </label>
                    <input
                      type="text"
                      value={formData.placeOfBirth}
                      onChange={(e) => handleInputChange('placeOfBirth', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select Gender</option>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Ethnicity
                    </label>
                    <input
                      type="text"
                      value={formData.ethnicity}
                      onChange={(e) => handleInputChange('ethnicity', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Marital Status (PTKP)
                    </label>
                    <select
                      value={formData.maritalStatus}
                      onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select Status</option>
                      <option value="TK/0">TK/0</option>
                      <option value="K/0">K/0</option>
                      <option value="K/1">K/1</option>
                      <option value="K/2">K/2</option>
                      <option value="K/3">K/3</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => handleInputChange('height', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => handleInputChange('weight', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      ID Number (KTP)
                    </label>
                    <input
                      type="text"
                      value={formData.idNumber}
                      onChange={(e) => handleInputChange('idNumber', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Tax Number (NPWP)
                    </label>
                    <input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) => handleInputChange('taxNumber', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      BPJS Number
                    </label>
                    <input
                      type="text"
                      value={formData.bpjsNumber}
                      onChange={(e) => handleInputChange('bpjsNumber', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Health Status
                    </label>
                    <select
                      value={formData.healthStatus}
                      onChange={(e) => handleInputChange('healthStatus', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select Status</option>
                      <option value="Sehat">Sehat</option>
                      <option value="Tidak Sehat">Tidak Sehat</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Driving License
                    </label>
                    <input
                      type="text"
                      value={formData.drivingLicense}
                      onChange={(e) => handleInputChange('drivingLicense', e.target.value)}
                      placeholder="e.g., A & C"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Blood Type
                    </label>
                    <select
                      value={formData.bloodType}
                      onChange={(e) => handleInputChange('bloodType', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select Blood Type</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="AB">AB</option>
                      <option value="O">O</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Current Address
                    </label>
                    <textarea
                      value={formData.currentAddress}
                      onChange={(e) => handleInputChange('currentAddress', e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Permanent Address
                    </label>
                    <textarea
                      value={formData.permanentAddress}
                      onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      value={formData.yearsOfExperience}
                      onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)}
                      min="0"
                      placeholder="e.g., 3"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Source
                    </label>
                    <select
                      value={formData.source}
                      onChange={(e) => {
                        handleInputChange('source', e.target.value)
                        handleInputChange('sourceDetail', '')
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="">Select Source</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Indeed">Indeed</option>
                      <option value="Jobstreet">Jobstreet</option>
                      <option value="Job Fair">Job Fair</option>
                      <option value="Local Site">Local Site</option>
                      <option value="Referral">Referral</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  {formData.source === 'Referral' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                        By Who
                      </label>
                      <input
                        type="text"
                        value={formData.sourceDetail}
                        onChange={(e) => handleInputChange('sourceDetail', e.target.value)}
                        placeholder="Enter referral name"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  )}
                  {formData.source === 'Others' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                        Please specify
                      </label>
                      <input
                        type="text"
                        value={formData.sourceDetail}
                        onChange={(e) => handleInputChange('sourceDetail', e.target.value)}
                        placeholder="Enter source details"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'professional' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Years of Experience */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      value={formData.yearsOfExperience}
                      onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)}
                      min="0"
                      placeholder="e.g., 3"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Skills */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Skills
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        placeholder="Add a skill"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddSkill()
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddSkill}
                        style={{
                          padding: '8px 16px',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: 'white',
                          backgroundColor: '#4f46e5',
                          cursor: 'pointer'
                        }}
                      >
                        Add Skill
                      </button>
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
                            onClick={() => handleRemoveSkill(skill)}
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
                </div>
              )}

              {activeTab === 'files' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* CV Upload - Mandatory */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Upload CV <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div 
                      style={{
                        border: `2px dashed ${fileErrors.cv ? '#FCA5A5' : formData.cvFile ? '#86EFAC' : '#D1D5DB'}`,
                        borderRadius: '8px',
                        padding: '24px',
                        textAlign: 'center',
                        cursor: isCompressing ? 'not-allowed' : 'pointer',
                        backgroundColor: fileErrors.cv ? '#FEF2F2' : formData.cvFile ? '#F0FDF4' : '#FAFAFA',
                        opacity: isCompressing ? 0.6 : 1
                      }}
                      onClick={() => !isCompressing && cvInputRef.current?.click()}
                    >
                      <CloudArrowUpIcon style={{ 
                        width: '48px', 
                        height: '48px', 
                        color: fileErrors.cv ? '#F87171' : formData.cvFile ? '#10B981' : '#9CA3AF', 
                        margin: '0 auto 12px' 
                      }} />
                      <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '4px' }}>
                        <span style={{ color: '#4F46E5', fontWeight: '500' }}>Click to upload</span> or drag and drop
                      </div>
                      <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        PDF, DOC, DOCX up to 2MB (auto-compressed if larger)
                      </div>
                      {isCompressing && (
                        <div style={{ marginTop: '8px', fontSize: '14px', color: '#3B82F6', fontWeight: '500' }}>
                          Compressing file...
                        </div>
                      )}
                      {formData.cvFile && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '14px', color: '#059669', fontWeight: '500' }}>
                            ✓ {formData.cvFile.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                            Size: {formatFileSize(formData.cvFile.size)}
                          </div>
                        </div>
                      )}
                      {fileErrors.cv && (
                        <div style={{ marginTop: '8px', fontSize: '14px', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <XCircleIcon style={{ width: '16px', height: '16px' }} />
                          {fileErrors.cv}
                        </div>
                      )}
                      {fileErrors.cvFile && (
                        <div style={{ marginTop: '8px', fontSize: '14px', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <XCircleIcon style={{ width: '16px', height: '16px' }} />
                          {fileErrors.cvFile}
                        </div>
                      )}
                    </div>
                    <input
                      ref={cvInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) await handleFileUpload(file, 'cv')
                      }}
                      disabled={isCompressing}
                    />
                  </div>

                  {/* Additional Files Upload */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Additional Files (Optional)
                    </label>
                    <div 
                      style={{
                        border: `2px dashed ${fileErrors.additional ? '#FCA5A5' : '#D1D5DB'}`,
                        borderRadius: '8px',
                        padding: '24px',
                        textAlign: 'center',
                        cursor: isCompressing ? 'not-allowed' : 'pointer',
                        backgroundColor: fileErrors.additional ? '#FEF2F2' : '#FAFAFA',
                        opacity: isCompressing ? 0.6 : 1
                      }}
                      onClick={() => !isCompressing && additionalFilesInputRef.current?.click()}
                    >
                      <CloudArrowUpIcon style={{ width: '48px', height: '48px', color: '#9CA3AF', margin: '0 auto 12px' }} />
                      <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '4px' }}>
                        <span style={{ color: '#4F46E5', fontWeight: '500' }}>Click to upload</span> or drag and drop
                      </div>
                      <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        PDF, DOC, DOCX, Images, Excel up to 2MB each (images auto-compressed if larger). Maximum 5 files.
                      </div>
                      {formData.additionalFiles.length >= 5 && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#D97706', fontWeight: '500' }}>
                          Maximum of 5 files reached. Remove a file to add more.
                        </div>
                      )}
                      {fileErrors.additional && (
                        <div style={{ marginTop: '8px', fontSize: '14px', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <XCircleIcon style={{ width: '16px', height: '16px' }} />
                          {fileErrors.additional}
                        </div>
                      )}
                    </div>
                    <input
                      ref={additionalFilesInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || [])
                        const currentCount = formData.additionalFiles.length
                        const remainingSlots = 5 - currentCount
                        
                        if (files.length > remainingSlots) {
                          setFileErrors(prev => ({ ...prev, additional: `You can only add ${remainingSlots} more file(s). Maximum of 5 files allowed.` }))
                          if (e.target) {
                            (e.target as HTMLInputElement).value = ''
                          }
                          return
                        }
                        
                        for (const file of files) {
                          await handleFileUpload(file, 'additional')
                        }
                        // Reset input
                        if (e.target) {
                          (e.target as HTMLInputElement).value = ''
                        }
                      }}
                      disabled={isCompressing || formData.additionalFiles.length >= 5}
                    />
                    
                    {/* Display uploaded additional files */}
                    {formData.additionalFiles.length > 0 && (
                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          Uploaded Files ({formData.additionalFiles.length}):
                        </p>
                        {formData.additionalFiles.map((file, index) => (
                          <div key={`new-${index}`} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '12px', 
                            backgroundColor: '#F9FAFB', 
                            borderRadius: '6px', 
                            border: '1px solid #E5E7EB' 
                          }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '14px', color: '#111827' }}>{file.name}</p>
                              <p style={{ fontSize: '12px', color: '#6B7280' }}>
                                Size: {formatFileSize(file.size)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAdditionalFile(index)}
                              style={{ marginLeft: '8px', color: '#DC2626', cursor: 'pointer' }}
                            >
                              <XCircleIcon style={{ width: '20px', height: '20px' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button
              type="submit"
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
              Save Candidate
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #D1D5DB',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      </div>
    </>
  )
}
