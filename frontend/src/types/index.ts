// User and Authentication Types
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  division?: string
  department?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface UserRole {
  id: string
  name: string
  permissions: string[]
  description?: string
}

export interface AuthResponse {
  success: boolean
  message: string
  data: {
    user: User
    accessToken: string
    refreshToken: string
  }
}

// Candidate Types
export interface Candidate {
  id: string
  userId: string
  user: User
  personalInfo: PersonalInfo
  contactInfo: ContactInfo
  professionalInfo: ProfessionalInfo
  applicationInfo: ApplicationInfo
  status: CandidateStatus
  source: string
  notes?: string
  files?: CandidateFile[]
  // Additional fields for UI
  division?: string | string[] // Division can be string or array
  positionAppliedFor?: string | string[] // Position applied for can be string or array
  formDataDiri?: any
  placeOfBirth?: string
  ethnicity?: string
  healthStatus?: string
  idNumber?: string
  taxNumber?: string
  bpjsNumber?: string
  height?: number | string
  weight?: number | string
  bloodType?: string
  drivingLicense?: string | string[]
  currentAddress?: string
  permanentAddress?: string
  languages?: any
  yearsOfExperience?: number | string
  skills?: string[]
  educations?: any[]
  createdAt: string
  updatedAt: string
}

export interface ApplicationInfo {
  appliedDate: string
  source: string
  status: CandidateStatus
  notes?: string
}

export interface CandidateFile {
  id: string
  name: string
  type: 'cv' | 'form_data' | 'other'
  data?: string // Optional base64 encoded data (legacy support)
  url?: string
  mimeType?: string
  size?: number
  uploadedAt: string
}

export interface PersonalInfo {
  firstName: string
  lastName: string
  dateOfBirth?: string
  gender?: string
  nationality?: string
  maritalStatus?: string
}

export interface ContactInfo {
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
}

export interface ProfessionalInfo {
  currentPosition?: string
  currentCompany?: string
  experience?: number
  skills: string[]
  education: Education[]
  workHistory: WorkHistory[]
  certifications: Certification[]
}

export interface Education {
  id: string
  institution: string
  degree: string
  fieldOfStudy: string
  startDate: string
  endDate?: string
  gpa?: number
  description?: string
}

export interface WorkHistory {
  id: string
  company: string
  position: string
  startDate: string
  endDate?: string
  description?: string
  achievements?: string[]
}

export interface Certification {
  id: string
  name: string
  issuer: string
  issueDate: string
  expiryDate?: string
  credentialId?: string
}

export type CandidateStatus = 
  | 'new'
  | 'screening'
  | 'interview_scheduled'
  | 'interviewed'
  | 'shortlisted'
  | 'rejected'
  | 'hired'
  | 'withdrawn'

// FPTK (Job Posting) Types
export interface FPTK {
  id: string
  title: string
  department: string
  position: string
  level: string
  location: string
  type: JobType
  employmentType?: string // Normalized employment type for display ("Contract", "Internship", "Full Time Employee")
  status: FPTKStatus
  currentStatus?: string
  statusEnum?: string
  description: string
  requirements: string[]
  responsibilities: string[]
  skills: string[]
  experience: ExperienceRequirement
  education: EducationRequirement
  salary: SalaryRange
  benefits: string[]
  hiringManager: string
  recruiter: string
  priority: Priority
  deadline?: string
  createdAt: string
  updatedAt: string
  // New fields for FPTK
  pt?: string
  noFktk?: string
  statusFktk?: string
  section?: string
  typeGrade?: string
  grade2?: string
  urgentNormal?: string
  priorityByMonthYear?: string
  jobSpecification?: string
  criteria?: string
  area?: string
  areaDetail?: string
  additionalOrReplacement?: string
  replacementName?: string
  resignReason?: string
  totalRequest?: number
  requestDate?: string
  remark?: string
  fptkReceiveDate?: string
  fptkFilePath?: string
  fptkFileName?: string
  milestones?: Array<{
    status: string
    startDate?: string
    endDate?: string
    updatedAt?: string
  }>
  appliedCandidates?: AppliedCandidate[]
  applicationsCount?: number
}

export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship'
export type FPTKStatus =
  | 'draft'
  | 'approved'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'expired'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface ExperienceRequirement {
  min: number
  max?: number
  specific?: string[]
}

export interface EducationRequirement {
  level: string
  fields?: string[]
  required: boolean
}

export interface SalaryRange {
  min: number
  max?: number
  currency: string
  period: 'hourly' | 'monthly' | 'yearly'
}

export interface AppliedCandidate {
  id: string
  applicationId?: string
  candidateId?: string
  fullName?: string
  name?: string
  email?: string
  phone?: string
  status: string
  backendStatus?: string
  appliedDate?: string
  rejectedDate?: string | null
  withdrawDate?: string | null
  /** Expected join date (set while candidate is at MCU on this position) */
  joinDate?: string | null
  source?: string
  skills?: string[]
  experience?: number
  yearsOfExperience?: number
  division?: string | string[] | null
  interviews?: any[]
}

// Application Types
export interface Application {
  id: string
  candidateId: string
  candidate: Candidate
  fptkId: string
  fptk: FPTK
  status: ApplicationStatus
  stage: ApplicationStage
  appliedAt: string
  reviewedAt?: string
  interviewScheduledAt?: string
  interviewedAt?: string
  decisionAt?: string
  notes?: string
  documents: ApplicationDocument[]
  interviews: Interview[]
  createdAt: string
  updatedAt: string
}

export type ApplicationStatus = 
  | 'applied'
  | 'under_review'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'interviewed'
  | 'offer_extended'
  | 'offer_accepted'
  | 'offer_declined'
  | 'rejected'
  | 'withdrawn'

export type ApplicationStage = 
  | 'application_review'
  | 'phone_screening'
  | 'technical_interview'
  | 'hr_interview'
  | 'final_interview'
  | 'reference_check'
  | 'offer_negotiation'
  | 'onboarding'

export interface ApplicationDocument {
  id: string
  name: string
  type: string
  url: string
  uploadedAt: string
}

// Interview Types
export interface Interview {
  id: string
  applicationId: string
  type: InterviewType
  scheduledAt: string
  duration: number
  location: string
  interviewers: string[]
  status: InterviewStatus
  feedback?: InterviewFeedback
  notes?: string
  createdAt: string
  updatedAt: string
}

export type InterviewType = 
  | 'phone_screening'
  | 'video_call'
  | 'in_person'
  | 'technical'
  | 'hr'
  | 'panel'
  | 'final'

export type InterviewStatus = 
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'

export interface InterviewFeedback {
  overallRating: number
  technicalSkills: number
  communication: number
  problemSolving: number
  culturalFit: number
  strengths: string[]
  weaknesses: string[]
  recommendation: 'hire' | 'no_hire' | 'maybe'
  comments: string
}

// Dashboard Types
export interface DashboardStats {
  totalCandidates: number
  activeApplications: number
  openPositions: number
  closedPositions: number
  holdPositions: number
  interviewsThisWeek: number
  hiredThisMonth: number
  recentActivity: any[]
  positionStatusByLocation: PositionStatusByLocation[]
  openPositionProgress: OpenPositionProgress[]
  slaByLocation: SLALocation[]
}

export interface PositionStatusByLocation {
  location: string
  total: number
  open: number
  closed: number
}

export interface OpenPositionProgress {
  areaDetail: string
  statusCounts: { [status: string]: number }
  total: number
  percentage: number
}

export interface SLALocation {
  areaDetail: string
  buckets: {
    '0-30 Days': number
    '31-60 Days': number
    '61-90 Days': number
    'Above 91 Days': number
  }
  total: number
}

export interface ChartData {
  name: string
  value: number
  color?: string
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Form Types
export interface LoginForm {
  email: string
  password: string
}

export interface CandidateForm {
  personalInfo: PersonalInfo
  contactInfo: ContactInfo
  professionalInfo: ProfessionalInfo
}

export interface FPTKForm {
  title: string
  department: string
  position: string
  level: string
  location: string
  type: JobType
  description: string
  requirements: string[]
  responsibilities: string[]
  skills: string[]
  experience: ExperienceRequirement
  education: EducationRequirement
  salary: SalaryRange
  benefits: string[]
  hiringManager: string
  recruiter: string
  priority: Priority
  deadline?: string
}

// Filter and Search Types
export interface CandidateFilters {
  status?: CandidateStatus[]
  source?: string[]
  experience?: {
    min: number
    max: number
  }
  skills?: string[]
  dateRange?: {
    start: string
    end: string
  }
}

export interface ApplicationFilters {
  status?: ApplicationStatus[]
  stage?: ApplicationStage[]
  fptkId?: string
  dateRange?: {
    start: string
    end: string
  }
}

export interface FPTKFilters {
  status?: FPTKStatus[]
  department?: string[]
  type?: JobType[]
  priority?: Priority[]
  dateRange?: {
    start: string
    end: string
  }
}
