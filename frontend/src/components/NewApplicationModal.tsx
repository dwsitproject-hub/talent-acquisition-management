'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Candidate, FPTK } from '@/types'

interface NewApplicationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (applicationData: any) => void
}

export default function NewApplicationModal({ isOpen, onClose, onSave }: NewApplicationModalProps) {
  const [formData, setFormData] = useState({
    candidateId: '',
    fptkId: '',
    status: 'applied' as const,
    stage: 'application_review' as const,
    notes: ''
  })

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [fptks, setFptks] = useState<FPTK[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Load candidates and FPTKs from localStorage
      const storedCandidates = localStorage.getItem('candidates')
      if (storedCandidates) {
        try {
          const parsedCandidates = JSON.parse(storedCandidates)
          // Ensure candidates have the required structure
          const validCandidates = parsedCandidates.filter((candidate: any) => 
            candidate && (candidate.user || candidate.personalInfo)
          )
          setCandidates(validCandidates)
        } catch (error) {
          console.error('Error parsing candidates from localStorage:', error)
          setCandidates([])
        }
      } else {
        setCandidates([])
      }
      
      // Mock FPTKs for now
      const mockFptks: FPTK[] = [
        {
          id: '1',
          title: 'Software Engineer',
          department: 'Engineering',
          position: 'Software Engineer',
          level: 'Mid-level',
          location: 'Jakarta',
          type: 'full-time',
          status: 'open',
          description: 'We are looking for a skilled software engineer to join our team.',
          requirements: ['Bachelor degree in Computer Science', '3+ years experience'],
          responsibilities: ['Develop software applications', 'Collaborate with team'],
          skills: ['JavaScript', 'React', 'Node.js'],
          experience: { min: 3, max: 5 },
          education: { level: 'Bachelor', fields: ['Computer Science'], required: true },
          salary: { min: 8000000, max: 12000000, currency: 'IDR', period: 'monthly' },
          benefits: ['Health insurance', 'Flexible hours'],
          hiringManager: 'John Doe',
          recruiter: 'Jane Smith',
          priority: 'high',
          deadline: '2024-12-31',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Frontend Developer',
          department: 'Engineering',
          position: 'Frontend Developer',
          level: 'Junior',
          location: 'Bandung',
          type: 'full-time',
          status: 'open',
          description: 'Join our frontend team to build amazing user interfaces.',
          requirements: ['Bachelor degree', '1+ years experience'],
          responsibilities: ['Build UI components', 'Optimize performance'],
          skills: ['React', 'TypeScript', 'CSS'],
          experience: { min: 1, max: 3 },
          education: { level: 'Bachelor', fields: ['Computer Science'], required: true },
          salary: { min: 6000000, max: 9000000, currency: 'IDR', period: 'monthly' },
          benefits: ['Remote work', 'Learning budget'],
          hiringManager: 'Alice Johnson',
          recruiter: 'Bob Wilson',
          priority: 'medium',
          deadline: '2024-12-15',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
      setFptks(mockFptks)
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Check if candidates are available
    if (candidates.length === 0) {
      alert('No candidates available. Please add candidates first.')
      setLoading(false)
      return
    }

    // Find selected candidate and FPTK
    const selectedCandidate = candidates.find(c => c.id === formData.candidateId)
    const selectedFptk = fptks.find(f => f.id === formData.fptkId)

    if (!selectedCandidate || !selectedFptk) {
      alert('Please select both candidate and job position')
      setLoading(false)
      return
    }

    const applicationData = {
      ...formData,
      candidate: selectedCandidate,
      fptk: selectedFptk,
      appliedAt: new Date().toISOString(),
      documents: [],
      interviews: []
    }

    onSave(applicationData)
    setLoading(false)
    onClose()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

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
        width: '90%',
        maxWidth: '600px',
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
            New Application
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Select Candidate *
            </label>
            <select
              name="candidateId"
              value={formData.candidateId}
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
              <option value="">Choose a candidate...</option>
              {candidates.length === 0 ? (
                <option value="" disabled>No candidates available. Please add candidates first.</option>
              ) : (
                candidates.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.user?.firstName || candidate.personalInfo?.firstName || 'Unknown'} {candidate.user?.lastName || candidate.personalInfo?.lastName || 'User'} - {candidate.user?.email || candidate.contactInfo?.email || 'No email'}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Select Job Position *
            </label>
            <select
              name="fptkId"
              value={formData.fptkId}
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
              <option value="">Choose a job position...</option>
              {fptks.map(fptk => (
                <option key={fptk.id} value={fptk.id}>
                  {fptk.title} - {fptk.department} ({fptk.location})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Application Status
            </label>
            <select
              name="status"
              value={formData.status}
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
              <option value="applied">Applied</option>
              <option value="under_review">Under Review</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview_scheduled">Interview Scheduled</option>
              <option value="interviewed">Interviewed</option>
              <option value="offer_extended">Offer Extended</option>
              <option value="offer_accepted">Offer Accepted</option>
              <option value="offer_declined">Offer Declined</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Application Stage
            </label>
            <select
              name="stage"
              value={formData.stage}
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
              <option value="application_review">Application Review</option>
              <option value="phone_screening">Phone Screening</option>
              <option value="technical_interview">Technical Interview</option>
              <option value="hr_interview">HR Interview</option>
              <option value="final_interview">Final Interview</option>
              <option value="reference_check">Reference Check</option>
              <option value="offer_negotiation">Offer Negotiation</option>
              <option value="onboarding">Onboarding</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              placeholder="Add any additional notes about this application..."
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
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              type="button"
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
              {loading ? 'Creating...' : 'Create Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
