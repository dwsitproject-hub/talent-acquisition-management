// Utility functions for candidate link generation and management

export interface CandidateLink {
  id: string
  candidateId: string
  token: string
  link: string
  createdAt: string
  expiresAt: string
  isActive: boolean
  submittedAt?: string
}

/**
 * Generate a unique token for candidate link
 */
export function generateToken(): string {
  return `cand_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Generate a unique link for a candidate
 * @param candidateId - The candidate ID
 * @returns CandidateLink object
 */
export function generateCandidateLink(candidateId: string): CandidateLink {
  const token = generateToken()
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const link = `${baseUrl}/candidate-form/${token}`
  
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  
  return {
    id: `link_${Date.now()}`,
    candidateId,
    token,
    link,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isActive: true
  }
}

/**
 * Save candidate link to localStorage
 */
export function saveCandidateLink(link: CandidateLink): void {
  try {
    const existingLinks = getCandidateLinks()
    existingLinks.push(link)
    localStorage.setItem('candidateLinks', JSON.stringify(existingLinks))
  } catch (error) {
    console.error('Error saving candidate link:', error)
  }
}

/**
 * Get all candidate links from localStorage
 */
export function getCandidateLinks(): CandidateLink[] {
  try {
    const linksJson = localStorage.getItem('candidateLinks')
    return linksJson ? JSON.parse(linksJson) : []
  } catch (error) {
    console.error('Error getting candidate links:', error)
    return []
  }
}

/**
 * Get candidate link by token
 */
export function getCandidateLinkByToken(token: string): CandidateLink | null {
  const links = getCandidateLinks()
  return links.find(link => link.token === token) || null
}

/**
 * Get candidate links for a specific candidate
 */
export function getCandidateLinksByCandidateId(candidateId: string): CandidateLink[] {
  const links = getCandidateLinks()
  return links.filter(link => link.candidateId === candidateId)
}

/**
 * Check if a link is valid (not expired, active, not submitted)
 */
export function isLinkValid(link: CandidateLink | null): boolean {
  if (!link) return false
  if (!link.isActive) return false
  if (link.submittedAt) return false
  
  const now = new Date()
  const expiresAt = new Date(link.expiresAt)
  return expiresAt > now
}

/**
 * Deactivate a candidate link (mark as submitted)
 */
export function deactivateCandidateLink(token: string): void {
  try {
    const links = getCandidateLinks()
    const updatedLinks = links.map(link => {
      if (link.token === token) {
        return {
          ...link,
          isActive: false,
          submittedAt: new Date().toISOString()
        }
      }
      return link
    })
    localStorage.setItem('candidateLinks', JSON.stringify(updatedLinks))
  } catch (error) {
    console.error('Error deactivating candidate link:', error)
  }
}

/**
 * Get the days remaining until link expires
 */
export function getDaysRemaining(link: CandidateLink): number {
  const now = new Date()
  const expiresAt = new Date(link.expiresAt)
  const diffMs = expiresAt.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

