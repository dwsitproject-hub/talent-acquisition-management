'use client'

import { useState, useRef } from 'react'
import { XMarkIcon, CloudArrowUpIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { compressFile, formatFileSize } from '@/utils/fileCompression'

interface AddCandidateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (candidateData: any, files?: { cvFile: File | null; formDataFile: File | null; additionalFiles?: File[] }) => void
}

interface FamilyMember {
  name: string
  gender: 'L' | 'P'
  relationship: string
  birthDate: string
  education: string
  occupation: string
}

interface Education {
  startMonth: string
  startYear: string
  endMonth: string
  endYear: string
  schoolName: string
  major: string
  location: string
  hasDiploma: boolean
  language: string
  speakingLevel: string
  writingLevel: string
}

interface WorkExperience {
  startMonth: string
  startYear: string
  endMonth: string
  endYear: string
  companyName: string
  position: string
  finalPosition: string
  startSalary: string
  endSalary: string
  reasonForLeaving: string
  jobDescription: string
}

interface Reference {
  name: string
  company: string
  address: string
  phone: string
  position: string
  relationship: string
}

export default function AddCandidateModal({ isOpen, onClose, onSave }: AddCandidateModalProps) {
  const [activeTab, setActiveTab] = useState('personal')
  const [formData, setFormData] = useState({
    // Personal Information
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
    
    // Family Information
    parents: [] as FamilyMember[],
    siblings: [] as FamilyMember[],
    spouse: [] as FamilyMember[],
    children: [] as FamilyMember[],
    
    // Education
    formalEducation: [] as Education[],
    nonFormalEducation: [] as Education[],
    
    // Work Experience
    workExperience: [] as WorkExperience[],
    
    // References
    references: [] as Reference[],
    
    // Additional Information
    emergencyContact: {
      name: '',
      relationship: '',
      address: '',
      phone: ''
    },
    canContactReferences: false,
    previousEmployment: {
      hasWorked: false,
      details: ''
    },
    familyInCompany: {
      hasFamily: false,
      details: ''
    },
    healthIssues: {
      hasIssues: false,
      details: ''
    },
    legalIssues: {
      hasIssues: false,
      details: ''
    },
    hobbies: '',
    physicalIssues: {
      hasIssues: false,
      details: ''
    },
    motivationToJoin: '',
    willingToRelocate: false,
    relocationReason: '',
    willingToTravel: false,
    travelReason: '',
    currentBenefits: '',
    expectedSalary: '',
    availableStartDate: '',
    
    // Files
    cvFile: null as File | null,
    additionalFiles: [] as File[]
  })

  const [fileErrors, setFileErrors] = useState<{ [key: string]: string }>({})
  const [isCompressing, setIsCompressing] = useState(false)

  const cvInputRef = useRef<HTMLInputElement>(null)
  const additionalFilesInputRef = useRef<HTMLInputElement>(null)

  const tabs = [
    { id: 'personal', name: 'Personal Info', icon: '👤' },
    { id: 'family', name: 'Family', icon: '👨‍👩‍👧‍👦' },
    { id: 'education', name: 'Education', icon: '🎓' },
    { id: 'experience', name: 'Experience', icon: '💼' },
    { id: 'references', name: 'References', icon: '📞' },
    { id: 'additional', name: 'Additional', icon: '📋' },
    { id: 'files', name: 'Files', icon: '📁' }
  ]

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNestedInputChange = (parentField: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parentField]: {
        ...(prev[parentField as keyof typeof prev] as Record<string, any> || {}),
        [field]: value
      }
    }))
  }

  const handleArrayAdd = (field: string, newItem: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field as keyof typeof prev] as any[]), newItem]
    }))
  }

  const handleArrayUpdate = (field: string, index: number, updatedItem: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field as keyof typeof prev] as any[]).map((item, i) => 
        i === index ? updatedItem : item
      )
    }))
  }

  const handleArrayRemove = (field: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field as keyof typeof prev] as any[]).filter((_, i) => i !== index)
    }))
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate CV is uploaded
    if (!formData.cvFile) {
      setFileErrors(prev => ({ ...prev, cv: 'CV document is required. Please upload a CV file (max 2MB).' }))
      setActiveTab('files')
      return
    }

    // Clear any previous errors
    setFileErrors({})
    onSave(formData, {
      cvFile: formData.cvFile,
      formDataFile: null,
      additionalFiles: formData.additionalFiles,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-6xl sm:align-middle">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Add New Candidate</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`${
                        activeTab === tab.id
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.name}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="max-h-96 overflow-y-auto">
                {activeTab === 'personal' && (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => handleInputChange('fullName', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Position Applied For</label>
                      <input
                        type="text"
                        value={formData.position || ''}
                        onChange={(e) => handleInputChange('position', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Place of Birth</label>
                      <input
                        type="text"
                        value={formData.placeOfBirth}
                        onChange={(e) => handleInputChange('placeOfBirth', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => handleInputChange('gender', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="">Select Gender</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ethnicity</label>
                      <input
                        type="text"
                        value={formData.ethnicity}
                        onChange={(e) => handleInputChange('ethnicity', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Marital Status (PTKP)</label>
                      <select
                        value={formData.maritalStatus}
                        onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                      <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
                      <input
                        type="number"
                        value={formData.height}
                        onChange={(e) => handleInputChange('height', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                      <input
                        type="number"
                        value={formData.weight}
                        onChange={(e) => handleInputChange('weight', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">ID Number (KTP)</label>
                      <input
                        type="text"
                        value={formData.idNumber}
                        onChange={(e) => handleInputChange('idNumber', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tax Number (NPWP)</label>
                      <input
                        type="text"
                        value={formData.taxNumber}
                        onChange={(e) => handleInputChange('taxNumber', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">BPJS Number</label>
                      <input
                        type="text"
                        value={formData.bpjsNumber}
                        onChange={(e) => handleInputChange('bpjsNumber', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Health Status</label>
                      <select
                        value={formData.healthStatus}
                        onChange={(e) => handleInputChange('healthStatus', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="">Select Status</option>
                        <option value="Sehat">Sehat</option>
                        <option value="Tidak Sehat">Tidak Sehat</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Driving License</label>
                      <input
                        type="text"
                        value={formData.drivingLicense}
                        onChange={(e) => handleInputChange('drivingLicense', e.target.value)}
                        placeholder="e.g., A & C"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Blood Type</label>
                      <select
                        value={formData.bloodType}
                        onChange={(e) => handleInputChange('bloodType', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="">Select Blood Type</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="AB">AB</option>
                        <option value="O">O</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Current Address</label>
                      <textarea
                        value={formData.currentAddress}
                        onChange={(e) => handleInputChange('currentAddress', e.target.value)}
                        rows={3}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Permanent Address</label>
                      <textarea
                        value={formData.permanentAddress}
                        onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
                        rows={3}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
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

                {/* Other tabs would be implemented similarly with their respective fields */}
                {activeTab !== 'personal' && activeTab !== 'files' && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">This section will be implemented in the next iteration.</p>
                    <p className="text-sm text-gray-400 mt-2">Tab: {activeTab}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Save Candidate
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
