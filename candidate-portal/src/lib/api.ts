import axios, { type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken, setAccessToken, clearAuth } from './auth'

export function getApiBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:4000/api`.replace(/\/$/, '')
  }
  return 'http://localhost:4000/api'.replace(/\/$/, '')
}

const client = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 25000,
  withCredentials: true,
})

// Attach access token to every request
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, attempt silent token refresh once, then clear auth
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(client(original))
          })
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const res = await axios.post(
          `${getApiBaseUrl()}/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const newToken: string = res.data?.data?.accessToken
        if (!newToken) throw new Error('No token in refresh response')
        setAccessToken(newToken)
        onRefreshed(newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return client(original)
      } catch {
        clearAuth()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

// ==================== TYPES ====================

export type PublishedJob = {
  id: string
  fptkNumber?: string | null
  positionTitle?: string | null
  position?: string | null
  department?: string | null
  location?: string | null
  employmentType?: string | null
  level?: string | null
  numberOfPositions?: number | null
  filledPositions?: number | null
  minEducation?: string | null
  minExperience?: number | null
  requiredSkills?: string[] | null
  jobDescription?: string | null
  publishedAt?: string | null
}

export type JobsPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type PublishedJobsParams = {
  page?: number
  limit?: number
  search?: string
  department?: string
  location?: string
  employmentType?: string
}

export type StatusHistoryEntry = {
  id: string
  applicationId: string
  fromStatus: string | null
  toStatus: string
  changedBy: string | null
  changedByName: string | null
  reason: string | null
  notes: string | null
  createdAt: string
}

export type Application = {
  id: string
  applicationNumber: string
  status: string
  currentStage: number
  source: string | null
  appliedAt: string
  screenedAt: string | null
  interviewedAt: string | null
  offeredAt: string | null
  hiredAt: string | null
  rejectedAt: string | null
  withdrawnAt: string | null
  rejectionReason: string | null
  notes: string | null
  fptk: {
    fptkNumber?: string | null
    position?: string | null
    positionTitle?: string | null
    department?: string | null
    location?: string | null
  } | null
  statusHistory: StatusHistoryEntry[]
}

export type LoginPayload = { email: string; password: string }
export type RegisterPayload = {
  email: string
  password: string
  firstName: string
  lastName: string
  phoneNumber?: string
}

// ==================== AUTH ====================

export async function apiLogin(payload: LoginPayload) {
  const res = await client.post<{
    success: boolean
    data: { accessToken: string; user: { id: string; email: string; firstName: string; lastName: string; role: string; phoneNumber?: string | null } }
  }>('/auth/login', payload)
  return res.data.data
}

export async function apiRegister(payload: RegisterPayload) {
  const res = await client.post<{ success: boolean; data: unknown }>('/auth/register', payload)
  return res.data
}

export async function apiLogout() {
  await client.post('/auth/logout')
}

// ==================== JOBS ====================

export async function fetchPublishedJobs(
  params: PublishedJobsParams
): Promise<{ data: PublishedJob[]; pagination: JobsPagination }> {
  const res = await client.get<{
    success?: boolean
    data: PublishedJob[]
    pagination: JobsPagination
  }>('/fptk/published', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search?.trim() || undefined,
      department: params.department?.trim() || undefined,
      location: params.location?.trim() || undefined,
      employmentType: params.employmentType?.trim() || undefined,
    },
  })

  const pagination = res.data.pagination || {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    total: 0,
    totalPages: 0,
  }

  return {
    data: Array.isArray(res.data.data) ? res.data.data : [],
    pagination,
  }
}

// ==================== APPLICATIONS ====================

export async function fetchMyApplications(params: { page?: number; limit?: number } = {}): Promise<{
  data: Application[]
  pagination: JobsPagination
}> {
  const res = await client.get<{
    success: boolean
    data: Application[]
    pagination: JobsPagination
  }>('/applications/my', {
    params: { page: params.page ?? 1, limit: params.limit ?? 20 },
  })
  return { data: res.data.data, pagination: res.data.pagination }
}

export async function fetchApplicationById(id: string): Promise<Application> {
  const res = await client.get<{ success: boolean; data: Application }>(`/applications/${id}`)
  return res.data.data
}

export async function withdrawApplication(id: string): Promise<void> {
  await client.post(`/applications/${id}/withdraw`)
}

export async function applyForJob(fptkId: string): Promise<Application> {
  const res = await client.post<{ success: boolean; data: Application }>('/applications', { fptkId })
  return res.data.data
}
