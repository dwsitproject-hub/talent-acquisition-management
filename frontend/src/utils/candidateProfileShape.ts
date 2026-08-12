/**
 * Normalizes candidate division/skill fields from API rows (string vs array, JSON languages blob,
 * compound "A / B" or "A, B" division strings) for consistent matching and display prep.
 */

import { candidateEligibleForPositionSuggestion } from '@/utils/candidateApplicationLock'

const DIVISION_SEP = /[,;/|]|(?:\s+&\s+)|(?:\s+\/\s+)/

function parseJsonObject(value: unknown): Record<string, any> | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

export function parseLanguagesData(candidate: any): Record<string, any> | null {
  if (!candidate?.languages) return null
  return parseJsonObject(candidate.languages)
}

/** Years of experience from API top-level field or languages JSON blob. */
export function getCandidateYearsOfExperience(candidate: any): number {
  if (!candidate) return 0
  const languagesData = parseLanguagesData(candidate)
  const raw = candidate.yearsOfExperience ?? languagesData?.yearsOfExperience
  if (raw === undefined || raw === null || raw === '') return 0
  const num = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10)
  return Number.isNaN(num) || num < 0 ? 0 : num
}

function parseFormDataDiri(candidate: any): Record<string, any> | null {
  if (!candidate?.formDataDiri) return null
  return parseJsonObject(candidate.formDataDiri)
}

function splitDivisionTokens(raw: string): string[] {
  return raw
    .split(DIVISION_SEP)
    .map((s) => s.trim())
    .filter(Boolean)
}

function addDivisionValues(set: Set<string>, value: unknown): void {
  if (value === undefined || value === null) return
  if (Array.isArray(value)) {
    value.forEach((item) => addDivisionValues(set, item))
    return
  }
  const s = String(value).trim()
  if (!s) return
  for (const token of splitDivisionTokens(s)) {
    if (token) set.add(token)
  }
}

/**
 * All division labels for a candidate from division, divisionList, user.division, languages.divisions.
 * Compound strings like "IT, HR" or "IT / HR" are split into separate entries.
 */
export function getCandidateDivisions(candidate: any): string[] {
  const divisions = new Set<string>()
  if (!candidate) return []

  addDivisionValues(divisions, candidate.division)
  addDivisionValues(divisions, candidate.divisionList)
  addDivisionValues(divisions, candidate.user?.division)

  const languagesData = parseLanguagesData(candidate)
  if (languagesData && languagesData.divisions !== undefined && languagesData.divisions !== null) {
    addDivisionValues(divisions, languagesData.divisions)
  }

  return Array.from(divisions)
}

function normalizeSkillKey(skill: string): string {
  return skill.trim().toLowerCase()
}

function addSkillsFromValue(bucket: Set<string>, value: unknown): void {
  if (value === undefined || value === null) return
  if (Array.isArray(value)) {
    value.forEach((item) => addSkillsFromValue(bucket, item))
    return
  }
  const s = String(value).trim()
  if (s) bucket.add(s)
}

/**
 * Skills from skills, professionalInfo.skills, formDataDiri.skills, languages.skills.
 */
export function getCandidateSkills(candidate: any): string[] {
  const bucket = new Set<string>()
  if (!candidate) return []

  addSkillsFromValue(bucket, candidate.skills)
  addSkillsFromValue(bucket, candidate.professionalInfo?.skills)

  const form = parseFormDataDiri(candidate)
  addSkillsFromValue(bucket, form?.skills)

  const languagesData = parseLanguagesData(candidate)
  addSkillsFromValue(bucket, languagesData?.skills)

  return Array.from(bucket)
}

/**
 * How many distinct required job skills appear on the candidate (case-insensitive, trimmed).
 */
export function countDistinctMatchingSkills(jobSkills: string[], candidate: any): number {
  const required = [
    ...new Set(
      (jobSkills || []).map((s) => normalizeSkillKey(String(s))).filter(Boolean)
    ),
  ]
  if (required.length === 0) return 0

  const candKeys = new Set(getCandidateSkills(candidate).map((s) => normalizeSkillKey(s)))
  return required.filter((k) => candKeys.has(k)).length
}

export function candidateDivisionMatchesJob(
  jobDivision: string | undefined | null,
  candidate: any
): boolean {
  const jd = String(jobDivision ?? '').trim()
  if (!jd) return false

  const jobKey = jd.toLowerCase()
  return getCandidateDivisions(candidate).some((d) => d.toLowerCase() === jobKey)
}

/** Minimum matching job skills required for suggested-candidate lists (create + edit position). */
export const SUGGESTED_CANDIDATE_MIN_MATCHING_SKILLS = 2

export function candidateMeetsSuggestedSkillMatch(
  jobSkills: string[] | undefined | null,
  candidate: any
): boolean {
  const skills = jobSkills || []
  if (skills.length === 0) return true
  return countDistinctMatchingSkills(skills, candidate) >= SUGGESTED_CANDIDATE_MIN_MATCHING_SKILLS
}

export function isSuggestedCandidateForPosition(
  candidate: any,
  jobDivision: string | undefined | null,
  jobSkills: string[] | undefined | null,
  appliedCandidateIds: Set<string>,
  options?: { excludeLocked?: boolean }
): boolean {
  if (!candidate?.id) return false
  if (!candidateDivisionMatchesJob(jobDivision, candidate)) return false
  if (appliedCandidateIds.has(candidate.id)) return false
  if (options?.excludeLocked !== false) {
    if (!candidateEligibleForPositionSuggestion(candidate)) return false
  }
  return candidateMeetsSuggestedSkillMatch(jobSkills, candidate)
}
