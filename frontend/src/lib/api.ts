import axios from 'axios'

// Dynamically determine API URL based on current hostname
// This allows the app to work with both localhost and public IP addresses
function getApiBaseUrl(): string {
  // If NEXT_PUBLIC_API_URL is explicitly set, use it
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  
  // In browser, use the same hostname as the frontend but with port 4000
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const protocol = window.location.protocol
    // Use port 4000 for the API
    return `${protocol}//${hostname}:4000/api`
  }
  
  // Fallback for server-side rendering
  return 'http://localhost:4000/api'
}

// Create axios instance with dynamic baseURL
// We'll set the baseURL dynamically on each request to ensure it's always current
export const api = axios.create({
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Set baseURL dynamically
api.defaults.baseURL = getApiBaseUrl()

// Interceptor to ensure baseURL is always current (in case of navigation)
// Only override if NEXT_PUBLIC_API_URL is not explicitly set
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // If NEXT_PUBLIC_API_URL is set, use it (don't override)
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
      config.baseURL = process.env.NEXT_PUBLIC_API_URL
    } else {
      // Fallback: use same hostname with port 4000
      const hostname = window.location.hostname
      const protocol = window.location.protocol
      config.baseURL = `${protocol}//${hostname}:4000/api`
    }
  }
  return config
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    try {
      // Only access localStorage if in browser environment
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    } catch (error) {
      // If localStorage is not available (e.g., during logout or SSR), skip adding token
      console.warn('Could not access localStorage for auth token:', error)
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

function getStoredRefreshToken(): string | null {
  try {
    const value = localStorage.getItem('refreshToken')
    if (!value || value === 'undefined' || value === 'null') {
      return null
    }
    return value
  } catch {
    return null
  }
}

function clearAuthAndRedirect() {
  try {
    localStorage.removeItem('authToken')
    localStorage.removeItem('refreshToken')
  } catch (e) {
    console.warn('Could not clear auth tokens during auth failure:', e)
  }
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

function isAuthRefreshRequest(config: { url?: string } | undefined): boolean {
  const url = config?.url || ''
  return url.includes('/auth/refresh')
}

function isAuthLoginRequest(config: { url?: string } | undefined): boolean {
  const url = config?.url || ''
  return url.includes('/auth/login')
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    const refreshToken = getStoredRefreshToken()
    const refreshRes = await api.post('/auth/refresh', refreshToken ? { refreshToken } : {})
    const payload = refreshRes?.data?.data
    const newAccessToken = payload?.accessToken
    const newRefreshToken = payload?.refreshToken

    if (!newAccessToken) {
      return null
    }

    try {
      localStorage.setItem('authToken', newAccessToken)
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken)
      }
    } catch (e) {
      console.warn('Could not persist refreshed tokens:', e)
    }

    return newAccessToken
  })()
    .catch(() => null)
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const originalRequest = error.config

    if (!originalRequest || typeof window === 'undefined' || status !== 401) {
      return Promise.reject(error)
    }

    // Never retry refresh/login themselves — that causes an infinite refresh loop.
    if (isAuthRefreshRequest(originalRequest) || isAuthLoginRequest(originalRequest)) {
      clearAuthAndRedirect()
      return Promise.reject(error)
    }

    // Already retried once after refresh; force logout instead of looping.
    if ((originalRequest as { __isRetryRequest?: boolean }).__isRetryRequest) {
      clearAuthAndRedirect()
      return Promise.reject(error)
    }

    ;(originalRequest as { __isRetryRequest?: boolean }).__isRetryRequest = true

    const newAccessToken = await refreshAccessToken()
    if (newAccessToken) {
      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api.request(originalRequest)
    }

    clearAuthAndRedirect()
    return Promise.reject(error)
  }
)

export default api

// Admin Users APIs
export const AdminUsersAPI = {
  async list(search?: string, role?: string) {
    const res = await api.get('/admin/users', { params: { search, role } })
    return res.data.data
  },
  async create(payload: any) {
    const res = await api.post('/admin/users', payload)
    return res.data.data
  },
  async update(id: string, payload: any) {
    const res = await api.put(`/admin/users/${id}`, payload)
    return res.data.data
  },
  async setStatus(id: string, isActive: boolean) {
    const res = await api.patch(`/admin/users/${id}/status`, { isActive })
    return res.data.data
  },
  async resetPassword(id: string, newPassword: string) {
    const res = await api.post(`/admin/users/${id}/reset-password`, { newPassword })
    return res.data
  },
  async downloadTemplate(format: 'csv' | 'xlsx' = 'xlsx') {
    const res = await api.get('/admin/users/bulk-template', {
      params: { format },
      responseType: 'blob',
    })
    return res.data as Blob
  },
  async bulkUpload(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/admin/users/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}

// Menu Access Management APIs
export const MenuAccessAPI = {
  async get() {
    const res = await api.get('/admin/menu-access')
    return res.data.data
  },
  async update(menuAccess: Record<string, any>) {
    const res = await api.put('/admin/menu-access', { menuAccess })
    return res.data
  },
}

// Master Division APIs
export const MasterDivisionAPI = {
  async getAll(search?: string, divisionName?: string) {
    const res = await api.get('/masters/divisions', { params: { search, divisionName } })
    return res.data.data
  },
  async getById(id: string) {
    const res = await api.get(`/masters/divisions/${id}`)
    return res.data.data
  },
  async create(payload: any) {
    const res = await api.post('/masters/divisions', payload)
    return res.data.data
  },
  async update(id: string, payload: any) {
    const res = await api.put(`/masters/divisions/${id}`, payload)
    return res.data.data
  },
  async delete(id: string) {
    await api.delete(`/masters/divisions/${id}`)
  },
  async downloadTemplate(format: 'csv' | 'xlsx' = 'csv') {
    const res = await api.get('/masters/divisions/bulk-template', {
      params: { format },
      responseType: 'blob',
    })
    return res.data as Blob
  },
  async bulkUpload(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/masters/divisions/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}

// Master Office Location APIs
export const MasterOfficeLocationAPI = {
  async getAll(search?: string, pt?: string, area?: string) {
    const res = await api.get('/masters/office-locations', { params: { search, pt, area } })
    return res.data.data
  },
  async getById(id: string) {
    const res = await api.get(`/masters/office-locations/${id}`)
    return res.data.data
  },
  async create(payload: any) {
    const res = await api.post('/masters/office-locations', payload)
    return res.data.data
  },
  async update(id: string, payload: any) {
    const res = await api.put(`/masters/office-locations/${id}`, payload)
    return res.data.data
  },
  async delete(id: string) {
    await api.delete(`/masters/office-locations/${id}`)
  },
  async downloadTemplate(format: 'csv' | 'xlsx' = 'csv') {
    const res = await api.get('/masters/office-locations/bulk-template', {
      params: { format },
      responseType: 'blob',
    })
    return res.data as Blob
  },
  async bulkUpload(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/masters/office-locations/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}

// FPTK APIs
export const FPTKAPI = {
  async getAll(
    filters?: {
      status?: string
      department?: string
      search?: string
      currentStatus?: string
      pt?: string
      area?: string
      areaDetail?: string
    },
    pagination?: { page?: number; limit?: number }
  ) {
    const res = await api.get('/fptk', { params: { ...filters, ...pagination } })
    return res.data
  },
  async getPositionOptions(
    filters?: {
      search?: string
      department?: string
      pt?: string
      area?: string
      areaDetail?: string
    },
    pagination?: { page?: number; limit?: number }
  ) {
    const res = await api.get('/fptk/position-options', { params: { ...filters, ...pagination } })
    return res.data
  },
  async getCountsByCurrentStatus(
    params?: { search?: string; pt?: string; area?: string; areaDetail?: string }
  ) {
    const q: Record<string, string> = {}
    if (params?.search) q.search = params.search
    if (params?.pt) q.pt = params.pt
    if (params?.area) q.area = params.area
    if (params?.areaDetail) q.areaDetail = params.areaDetail
    const res = await api.get('/fptk/counts-by-current-status', {
      params: Object.keys(q).length ? q : {},
    })
    return res.data.data as Record<string, number>
  },
  async getSummaryByPosition() {
    const res = await api.get('/fptk/summary-by-position')
    return res.data.data
  },
  async getById(id: string) {
    const res = await api.get(`/fptk/${id}`)
    return res.data.data
  },
  async create(payload: any) {
    // If there's a file, send as FormData, otherwise send as JSON
    if (payload.fptkFile && payload.fptkFile instanceof File) {
      const formData = new FormData()
      Object.keys(payload).forEach(key => {
        if (key === 'fptkFile') {
          formData.append('fptkFile', payload.fptkFile)
        } else if (key === 'requiredSkills' && Array.isArray(payload[key])) {
          // Handle arrays properly
          payload[key].forEach((item: any) => formData.append('requiredSkills[]', item))
        } else if (key === 'appliedCandidates' && Array.isArray(payload[key])) {
          // Handle applied candidates array
          formData.append('appliedCandidates', JSON.stringify(payload[key]))
        } else if (payload[key] !== null && payload[key] !== undefined) {
          if (typeof payload[key] === 'object' && !Array.isArray(payload[key])) {
            formData.append(key, JSON.stringify(payload[key]))
          } else {
            formData.append(key, payload[key])
          }
        }
      })
      const res = await api.post('/fptk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return res.data.data
    } else {
      const res = await api.post('/fptk', payload)
      return res.data.data
    }
  },
  async update(id: string, payload: any) {
    // If there's a file, send as FormData, otherwise send as JSON
    if (payload.fptkFile && payload.fptkFile instanceof File) {
      const formData = new FormData()
      Object.keys(payload).forEach(key => {
        if (key === 'fptkFile') {
          formData.append('fptkFile', payload.fptkFile)
        } else if (key === 'requiredSkills' && Array.isArray(payload[key])) {
          payload[key].forEach((item: any) => formData.append('requiredSkills[]', item))
        } else if (key === 'appliedCandidates' && Array.isArray(payload[key])) {
          formData.append('appliedCandidates', JSON.stringify(payload[key]))
        } else if (payload[key] !== null && payload[key] !== undefined) {
          if (typeof payload[key] === 'object' && !Array.isArray(payload[key])) {
            formData.append(key, JSON.stringify(payload[key]))
          } else {
            formData.append(key, payload[key])
          }
        }
      })
      const res = await api.put(`/fptk/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return res.data.data
    } else {
      const res = await api.put(`/fptk/${id}`, payload)
      return res.data.data
    }
  },
  async publish(id: string) {
    const res = await api.post(`/fptk/${id}/publish`)
    return res.data.data
  },
  async unpublish(id: string) {
    const res = await api.post(`/fptk/${id}/unpublish`)
    return res.data.data
  },
  async delete(id: string) {
    const res = await api.delete(`/fptk/${id}`)
    return res.data.data
  },
  async deleteBulk(ids: string[]) {
    const res = await api.post('/fptk/bulk-delete', { ids })
    return res.data.data
  },
}

// Candidates APIs
export const CandidatesAPI = {
  async getAll(
    filters?: { search?: string; skills?: string[]; minScore?: number; sortBy?: 'name' | string },
    pagination?: { page?: number; limit?: number }
  ) {
    const params: any = { ...pagination }
    if (filters?.search) params.search = filters.search
    if (filters?.skills) params.skills = filters.skills.join(',')
    if (filters?.minScore) params.minScore = filters.minScore
    if (filters?.sortBy) params.sortBy = filters.sortBy
    const res = await api.get('/candidates', { params })
    // API returns { success: true, data: [...], pagination: {...} }
    // Return the full response so frontend can access .data and .pagination
    return res.data
  },
  async create(payload: any) {
    console.log('CandidatesAPI.create called with:', payload)
    try {
      const res = await api.post('/candidates', payload)
      console.log('CandidatesAPI.create response:', res.data)
      return res.data
    } catch (error: any) {
      console.error('CandidatesAPI.create error:', error)
      console.error('Error response:', error.response?.data)
      throw error
    }
  },
  async downloadTemplate(format: 'csv' | 'xlsx' = 'csv') {
    const res = await api.get('/candidates/bulk-template', {
      params: { format },
      responseType: 'blob',
    })
    return res.data as Blob
  },
  async bulkUpload(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/candidates/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
  async update(id: string, payload: any) {
    console.log('CandidatesAPI.update called with:', id, payload)
    const res = await api.put(`/candidates/${id}`, payload)
    return res.data
  },
  async getById(id: string) {
    const res = await api.get(`/candidates/${id}`)
    return res.data.data
  },
  async uploadDocument(id: string, file: File, type: string = 'RESUME') {
    const formData = new FormData()
    formData.append('file', file)
    if (type) {
      formData.append('type', type)
    }

    const res = await api.post(`/candidates/${id}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return res.data
  },
  async createFormLink(id: string, options?: { expiresInDays?: number }) {
    const res = await api.post(`/candidates/${id}/form-link`, options || {})
    return res.data
  },
  async getMe() {
    const res = await api.get('/candidates/me')
    return res.data.data
  },
  async updateMe(payload: any) {
    const res = await api.put('/candidates/me', payload)
    return res.data.data
  },
}

// Applications APIs
export const ApplicationsAPI = {
  async getAll(
    filters?: { status?: string; fptkId?: string; candidateId?: string; department?: string; search?: string },
    pagination?: { page?: number; limit?: number }
  ) {
    const params: any = { ...pagination }
    if (filters?.status) params.status = filters.status
    if (filters?.fptkId) params.fptkId = filters.fptkId
    if (filters?.candidateId) params.candidateId = filters.candidateId
    if (filters?.department) params.department = filters.department
    if (filters?.search) params.search = filters.search
    const res = await api.get('/applications', { params })
    return res.data
  },
  async getById(id: string) {
    const res = await api.get(`/applications/${id}`)
    return res.data.data
  },
}

// Dashboard APIs
export const DashboardAPI = {
  async getStats(params?: {
    priority?: string
    positionStatus?: string
    periodStart?: string
    periodEnd?: string
    previousStart?: string
    previousEnd?: string
  }) {
    const res = await api.get('/dashboard/stats', { params })
    return res.data.data
  },
}