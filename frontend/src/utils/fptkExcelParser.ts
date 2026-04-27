import ExcelJS from 'exceljs'
import { FPTK, JobType, FPTKStatus, Priority } from '@/types'
import { MasterOfficeLocationAPI, MasterDivisionAPI } from '@/lib/api'
import {
  FPTK_TEMPLATE_HEADERS,
  FPTK_STATUS_FKTK_OPTIONS,
  FPTK_EMPLOYMENT_TYPE_OPTIONS,
  FPTK_PRIORITY_OPTIONS,
  FPTK_CRITERIA_OPTIONS,
  FPTK_ADDITIONAL_OR_REPLACEMENT_OPTIONS,
  FPTK_CURRENT_STATUS_OPTIONS,
  FPTK_APPLIED_CANDIDATE_STATUS_OPTIONS,
  FPTK_EXCEL_APPLIED_CANDIDATE_SLOT_COUNT,
  normalizeExcelEnum,
  normalizeEmploymentTypeForPayload,
  isAllowedAppliedCandidateStatus,
  getAppliedCandidateHeaderDefs,
  ALLOWED_STATUS_FKTK,
  ALLOWED_PRIORITY,
  ALLOWED_CRITERIA,
  ALLOWED_ADDITIONAL_OR_REPLACEMENT,
  ALLOWED_CURRENT_STATUS,
} from '@/utils/fptkExcelOptions'

export interface FPTKUploadResult {
  success: FPTK[]
  failed: Array<{
    row: number
    data: any
    errors: string[]
  }>
  total: number
  successCount: number
  failedCount: number
}

export interface FPTKExcelRow {
  pt?: string
  noFktk?: string
  statusFktk?: string
  division?: string
  section?: string
  hiringManager?: string
  position?: string
  employmentType?: string
  typeGrade?: string
  grade2?: string
  priority?: string
  priorityByMonthYear?: string
  jobSpecification?: string
  criteria?: string
  area?: string
  areaDetail?: string
  additionalOrReplacement?: string
  replacementName?: string
  resignReason?: string
  totalRequest?: string | number
  currentStatus?: string
  requestDate?: string
  appliedCandidates?: Array<{ fullName: string; email: string; status: string }>
}

// Field mapping from Excel column names to our fields
// This mapping is case-insensitive and handles variations
const FIELD_MAPPING: Record<string, keyof FPTKExcelRow> = {
  'PT': 'pt',
  'No FKTK': 'noFktk',
  'No FPTK': 'noFktk',
  'FKTK': 'noFktk',
  'FPTK': 'noFktk',
  'Status FKTK': 'statusFktk',
  'Status FPTK': 'statusFktk',
  'Division': 'division',
  'Section': 'section',
  'Hiring Manager': 'hiringManager',
  'Position': 'position',
  'Position Name': 'position',
  'Position Title': 'position',
  'Job Title': 'position',
  'Job Position': 'position',
  'Nama Posisi': 'position',
  'Jabatan': 'position',
  'Employment Type': 'employmentType',
  'Type Grade': 'typeGrade',
  'Grade2': 'grade2',
  'Grade 2': 'grade2',
  'Priority': 'priority',
  'Priority by month-year': 'priorityByMonthYear',
  'Priority by Month-Year': 'priorityByMonthYear',
  'Priority by month year': 'priorityByMonthYear',
  'Priority By Month-Year': 'priorityByMonthYear',
  'Priority By Month Year': 'priorityByMonthYear',
  'Job Specification and Qualifications': 'jobSpecification',
  'Job Specification': 'jobSpecification',
  'Job Specification & Qualifications': 'jobSpecification',
  'Criteria': 'criteria',
  'Area': 'area',
  'Area Detail': 'areaDetail',
  'Additional or Replacement': 'additionalOrReplacement',
  'Additional/Replacement': 'additionalOrReplacement',
  'Replacement Name': 'replacementName',
  'Resign Reason': 'resignReason',
  'Total Request': 'totalRequest',
  'Current Status': 'currentStatus',
  'Request Date': 'requestDate',
}

const APPLIED_CANDIDATE_HEADER_MAP = getAppliedCandidateHeaderDefs()

const excelCellToString = (value: any): string => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()

  // ExcelJS rich text: { richText: [{ text: "..." }, ...] }
  if (typeof value === 'object') {
    if (typeof (value as any).text === 'string') return (value as any).text
    if (Array.isArray((value as any).richText)) {
      return (value as any).richText.map((p: any) => p?.text || '').join('')
    }
    if (typeof (value as any).result === 'string') return (value as any).result
    if (typeof (value as any).hyperlink === 'string') {
      // Prefer display text if present, otherwise hyperlink.
      const display = typeof (value as any).text === 'string' ? (value as any).text : ''
      return display || (value as any).hyperlink
    }
  }

  try {
    return String(value)
  } catch {
    return ''
  }
}

/**
 * Best-effort position name for failed-upload CSV: Excel row (position), parsed FPTK (title/position), or API payload.
 */
export function getPositionNameForFailedExport(data: any): string {
  if (!data || typeof data !== 'object') return '—'
  const candidates = [
    data.position,
    data.Position,
    data.title,
    data.Title,
    data.positionTitle,
  ]
  for (const c of candidates) {
    if (c === undefined || c === null) continue
    const s = typeof c === 'object' ? excelCellToString(c) : String(c)
    const t = s.trim()
    if (t) return t
  }
  return '—'
}

export interface FptkValidationContext {
  allowedPt: Set<string>
  officeLocations: Array<{ pt?: string; area?: string; areaDetail?: string }>
  divisions: Array<{ divisionName?: string; sectionName?: string }>
}

export function buildFptkValidationContext(
  officeLocations: any[],
  divisions: any[]
): FptkValidationContext {
  const allowedPt = new Set(
    officeLocations.map((l) => (l.pt || '').toString().trim()).filter(Boolean)
  )
  return { allowedPt, officeLocations, divisions }
}

function indexToColumnLetter(index0: number): string {
  let n = index0 + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function validateAndConvertFPTK(
  row: FPTKExcelRow,
  rowNumber: number,
  ctx: FptkValidationContext
): { valid: boolean; errors: string[]; fptk?: FPTK } {
  const errors: string[] = []

  const ptRaw = row.pt?.toString().trim() || ''
  if (!ptRaw) {
    errors.push('PT is required')
  } else if (!ctx.allowedPt.has(ptRaw)) {
    errors.push(`PT "${ptRaw}" is not registered in Master Office Location`)
  }

  if (!row.section || !row.section.toString().trim()) {
    errors.push('Section is required')
  }
  if (!row.hiringManager || !row.hiringManager.toString().trim()) {
    errors.push('Hiring Manager is required')
  }
  if (!row.position || !row.position.toString().trim()) {
    errors.push('Position is required')
  }
  if (!row.criteria || !row.criteria.toString().trim()) {
    errors.push('Criteria is required')
  }
  if (!row.area || !row.area.toString().trim()) {
    errors.push('Area is required')
  }
  if (!row.areaDetail || !row.areaDetail.toString().trim()) {
    errors.push('Area Detail is required')
  }
  if (!row.additionalOrReplacement || !row.additionalOrReplacement.toString().trim()) {
    errors.push('Additional or Replacement is required')
  }

  const divisionStr = row.division?.toString().trim() || ''
  if (!divisionStr) {
    errors.push('Division is required')
  }
  if (divisionStr) {
    const divNames = new Set(
      ctx.divisions.map((d) => (d.divisionName || '').toString().trim()).filter(Boolean)
    )
    const hasDiv = [...divNames].some((d) => normalizeExcelEnum(d) === normalizeExcelEnum(divisionStr))
    if (!hasDiv) {
      errors.push(`Division "${divisionStr}" is not found in Master Division`)
    }
  }

  const sectionStr = row.section?.toString().trim() || ''
  if (divisionStr && sectionStr) {
    const ok = ctx.divisions.some(
      (d) =>
        normalizeExcelEnum(d.divisionName || '') === normalizeExcelEnum(divisionStr) &&
        normalizeExcelEnum(d.sectionName || '') === normalizeExcelEnum(sectionStr)
    )
    if (!ok) {
      errors.push(`Section "${sectionStr}" is not valid for Division "${divisionStr}" in master data`)
    }
  }

  if (ptRaw && row.area?.toString().trim()) {
    const areaOk = ctx.officeLocations.some(
      (l) =>
        (l.pt || '').toString().trim() === ptRaw &&
        normalizeExcelEnum(l.area || '') === normalizeExcelEnum(row.area?.toString() || '')
    )
    if (!areaOk) {
      errors.push(`Area "${row.area}" is not valid for PT "${ptRaw}"`)
    }
  }

  if (ptRaw && row.area?.toString().trim() && row.areaDetail?.toString().trim()) {
    const tripleOk = ctx.officeLocations.some(
      (l) =>
        (l.pt || '').toString().trim() === ptRaw &&
        normalizeExcelEnum(l.area || '') === normalizeExcelEnum(row.area?.toString() || '') &&
        normalizeExcelEnum((l as any).areaDetail || '') === normalizeExcelEnum(row.areaDetail?.toString() || '')
    )
    if (!tripleOk) {
      errors.push(
        `Area Detail "${row.areaDetail}" is not valid for PT "${ptRaw}" and Area "${row.area}"`
      )
    }
  }

  const sf = row.statusFktk?.toString().trim() || ''
  if (sf && !ALLOWED_STATUS_FKTK.has(normalizeExcelEnum(sf))) {
    errors.push(
      `Invalid Status FKTK: "${row.statusFktk}". Use: ${FPTK_STATUS_FKTK_OPTIONS.join(' or ')}`
    )
  }

  const empNorm = normalizeEmploymentTypeForPayload(row.employmentType?.toString())
  if (row.employmentType?.toString().trim() && !empNorm) {
    errors.push(
      `Invalid Employment Type: "${row.employmentType}". Use: ${FPTK_EMPLOYMENT_TYPE_OPTIONS.join(', ')}`
    )
  }

  if (!row.employmentType?.toString().trim()) {
    errors.push('Employment Type is required')
  }

  const pr = row.priority?.toString().trim() || ''
  if (pr && !ALLOWED_PRIORITY.has(normalizeExcelEnum(pr))) {
    errors.push(`Invalid Priority: "${row.priority}". Use: ${FPTK_PRIORITY_OPTIONS.join(', ')}`)
  }

  let priorityValue: Priority = 'medium'
  let priorityOriginalValue = ''
  if (pr) {
    const priorityStr = pr.toUpperCase()
    if (['P0', 'P1', 'P2'].includes(priorityStr)) {
      priorityOriginalValue = priorityStr
      priorityValue =
        priorityStr === 'P0' ? 'urgent' : priorityStr === 'P1' ? 'high' : priorityStr === 'P2' ? 'medium' : 'low'
    }
  }

  const crit = row.criteria?.toString().trim() || ''
  if (crit && !ALLOWED_CRITERIA.has(normalizeExcelEnum(crit))) {
    errors.push(`Invalid Criteria: "${row.criteria}". Use: ${FPTK_CRITERIA_OPTIONS.join(' or ')}`)
  }

  const addRep = row.additionalOrReplacement?.toString().trim() || ''
  if (addRep && !ALLOWED_ADDITIONAL_OR_REPLACEMENT.has(normalizeExcelEnum(addRep))) {
    errors.push(
      `Invalid Additional or Replacement: "${row.additionalOrReplacement}". Use: ${FPTK_ADDITIONAL_OR_REPLACEMENT_OPTIONS.join(' or ')}`
    )
  }

  let currentStatus = row.currentStatus?.toString().trim() || 'Pending FKTK'
  if (currentStatus && !ALLOWED_CURRENT_STATUS.has(normalizeExcelEnum(currentStatus))) {
    errors.push(
      `Invalid Current Status: "${row.currentStatus}". Use: ${FPTK_CURRENT_STATUS_OPTIONS.join(', ')}`
    )
  }

  let status: FPTKStatus = 'draft'
  if (row.currentStatus) {
    const statusStr = row.currentStatus.toString().toLowerCase().trim()
    const validStatuses: FPTKStatus[] = ['draft', 'approved', 'open', 'partially_filled', 'filled', 'cancelled', 'expired']
    if (validStatuses.includes(statusStr as FPTKStatus)) {
      status = statusStr as FPTKStatus
    } else {
      const statusMap: Record<string, FPTKStatus> = {
        open: 'open',
        're-open': 'open',
        'pending fktk': 'draft',
        hold: 'draft',
        cancel: 'cancelled',
        cancelled: 'cancelled',
        'internal movement': 'draft',
        close: 'filled',
      }
      status = statusMap[statusStr] || 'draft'
    }
  } else {
    currentStatus = 'Pending FKTK'
  }

  if (row.appliedCandidates && row.appliedCandidates.length > 0) {
    row.appliedCandidates.forEach((ac, idx) => {
      if (ac.status && !isAllowedAppliedCandidateStatus(ac.status)) {
        errors.push(
          `Applied Candidate ${idx + 1} Status "${ac.status}" is not a valid option (see template list)`
        )
      }
    })
  }

  let jobType: JobType = 'full-time'
  const empCanonical = normalizeEmploymentTypeForPayload(row.employmentType?.toString())
  if (empCanonical === 'Contract') jobType = 'contract'
  else if (empCanonical === 'Internship') jobType = 'internship'
  else if (empCanonical === 'Full Time Employee') jobType = 'full-time'

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // Convert to FPTK object
  const fptk: FPTK = {
    id: `uploaded-${Date.now()}-${rowNumber}`,
    title: row.position?.toString().trim() || '',
    department: row.division?.toString().trim() || '',
    position: row.position?.toString().trim() || '',
    level: row.typeGrade?.toString().trim() || 'Not specified',
    location: row.area === 'Site' ? 'Site' : 'Head Office',
    type: jobType,
    status,
    currentStatus,
    statusEnum: status.toUpperCase(),
    description: row.jobSpecification?.toString().trim() || '',
    requirements: [],
    responsibilities: [],
    skills: [],
    experience: { min: 0 },
    education: { level: 'Any', fields: [], required: false },
    salary: { min: 0, currency: 'IDR', period: 'monthly' },
    benefits: [],
    hiringManager: row.hiringManager!.toString().trim(),
    recruiter: '',
    priority: priorityValue, // Keep for legacy compatibility
    deadline: undefined, // Deadline should be empty, not from priorityByMonthYear
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // Store additional form data as extra properties
  const fptkWithExtra = {
    ...fptk,
    pt: row.pt?.toString().trim() || '',
    noFktk: row.noFktk?.toString().trim() || '',
    statusFktk: row.statusFktk?.toString().trim() || '',
    section: row.section?.toString().trim() || '',
    employmentType: empCanonical || row.employmentType?.toString().trim() || '',
    typeGrade: row.typeGrade?.toString().trim() || '',
    grade2: row.grade2?.toString().trim() || '',
    // Store original priority value (P0, P1, P2) in both priority and urgentNormal for compatibility
    priority: priorityOriginalValue || row.priority?.toString().trim() || '',
    urgentNormal: priorityOriginalValue || row.priority?.toString().trim() || '',
    priorityByMonthYear: row.priorityByMonthYear?.toString().trim() || '',
    jobSpecification: row.jobSpecification?.toString().trim() || '',
    criteria: row.criteria?.toString().trim() || '',
    area: row.area?.toString().trim() || '',
    areaDetail: row.areaDetail?.toString().trim() || '',
    additionalOrReplacement: row.additionalOrReplacement?.toString().trim() || '',
    replacementName: row.replacementName?.toString().trim() || '',
    resignReason: row.resignReason?.toString().trim() || '',
    totalRequest: row.totalRequest?.toString().trim() || '',
    requestDate: row.requestDate?.toString().trim() || '',
    appliedCandidates: row.appliedCandidates || [],
  }

  return { valid: true, errors: [], fptk: fptkWithExtra as any }
}

export function parseFPTKExcelFile(file: File): Promise<FPTKUploadResult> {
  return (async () => {
    try {
      const [officeLocations, divisions] = await Promise.all([
        MasterOfficeLocationAPI.getAll().catch(() => [] as any[]),
        MasterDivisionAPI.getAll().catch(() => [] as any[]),
      ])
      const ctx = buildFptkValidationContext(officeLocations || [], divisions || [])

      const arrayBuffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(arrayBuffer)

      // Pick the first non-hidden worksheet with at least a header + one data row.
      // Templates include a veryHidden `_lists` sheet which must be ignored.
      const visibleSheets = (workbook.worksheets || []).filter(
        (ws: any) => ws && ws.state !== 'veryHidden'
      )
      const worksheet =
        visibleSheets.find((ws: any) => (ws?.rowCount || 0) >= 2) ||
        visibleSheets[0] ||
        (workbook.worksheets || []).find((ws: any) => (ws?.rowCount || 0) >= 2) ||
        workbook.worksheets?.[0]

      if (!worksheet) {
        throw new Error('No worksheet found in the Excel file')
      }

      if (worksheet.rowCount < 2) {
        throw new Error('Excel file must have at least 2 rows (header and data)')
      }

      // Get headers (first row)
      const headerRow = worksheet.getRow(1)
      const headers: string[] = []
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cell.value?.toString().trim() || ''
      })
      
      // Create a normalized mapping: normalized header -> original header -> field key
      const headerMapping: Record<string, { original: string; fieldKey: keyof FPTKExcelRow }> = {}
      headers.forEach((header) => {
        const normalized = header.toLowerCase().trim()
        // Try exact match first
        if (FIELD_MAPPING[header]) {
          headerMapping[normalized] = { original: header, fieldKey: FIELD_MAPPING[header] }
        } else {
          // Try case-insensitive match
          for (const [key, value] of Object.entries(FIELD_MAPPING)) {
            if (key.toLowerCase() === normalized) {
              headerMapping[normalized] = { original: header, fieldKey: value }
              break
            }
          }
        }
      })
      
      // Process data rows
      const success: FPTK[] = []
      const failed: Array<{ row: number; data: any; errors: string[] }> = []

      // Helper function to convert Excel date to string
      const excelDateToString = (value: number): string => {
        const excelEpoch = new Date(1899, 11, 30) // Excel epoch is 1899-12-30
        const date = new Date(excelEpoch.getTime() + value * 86400000)
        return date.toISOString().split('T')[0] // YYYY-MM-DD format
      }

      // Helper function to convert Excel date to month-year format
      const excelDateToMonthYear = (value: number): string => {
        const excelEpoch = new Date(1899, 11, 30)
        const date = new Date(excelEpoch.getTime() + value * 86400000)
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
        const month = monthNames[date.getMonth()] || 'Unknown'
        const year = String(date.getFullYear()).slice(-2) // Last 2 digits of year
        return `${month}-${year}`
      }

      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i)
        const rowValues: any[] = []
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowValues[colNumber - 1] = cell.value
        })
        
        // Skip empty rows
        if (rowValues.every(cell => !cell || cell.toString().trim() === '')) {
          continue
        }

        // Map row data to FPTKExcelRow using normalized header mapping
        const rowData: FPTKExcelRow = {}
        headers.forEach((header, index) => {
          const normalized = header.toLowerCase().trim()
          const mapping = headerMapping[normalized]
          if (mapping && rowValues[index] !== undefined && rowValues[index] !== null && rowValues[index] !== '') {
            let value = rowValues[index]
            
            // Handle priorityByMonthYear - if it's a number (Excel date serial), convert to text format
            if (mapping.fieldKey === 'priorityByMonthYear' && typeof value === 'number') {
              try {
                value = excelDateToMonthYear(value)
              } catch (e) {
                // If conversion fails, just use the number as string
                value = value.toString()
              }
            }
            
            // Handle requestDate - if it's a number (Excel date serial), convert to ISO string
            // If empty, set to today's date
            if (mapping.fieldKey === 'requestDate') {
              if (typeof value === 'number') {
                try {
                  value = excelDateToString(value)
                } catch (e) {
                  // If conversion fails, use today's date
                  value = new Date().toISOString().split('T')[0]
                }
              } else if (value instanceof Date) {
                value = value.toISOString().split('T')[0]
              } else if (!value || value.toString().trim() === '') {
                // If empty, set to today's date
                value = new Date().toISOString().split('T')[0]
              }
            }

            if (mapping.fieldKey === 'position') {
              value = excelCellToString(value).trim()
            }
            
            rowData[mapping.fieldKey] = value
          }
        })

        // Parse applied candidate columns from template (optional)
        const appliedCandidates: Array<{ fullName: string; email: string; status: string }> = []
        APPLIED_CANDIDATE_HEADER_MAP.forEach((def) => {
          const fullNameIdx = headers.findIndex((h) => h.toLowerCase().trim() === def.fullName.toLowerCase())
          const emailIdx = headers.findIndex((h) => h.toLowerCase().trim() === def.email.toLowerCase())
          const statusIdx = headers.findIndex((h) => h.toLowerCase().trim() === def.status.toLowerCase())
          const fullNameVal = fullNameIdx >= 0 ? rowValues[fullNameIdx] : ''
          const emailVal = emailIdx >= 0 ? rowValues[emailIdx] : ''
          const statusVal = statusIdx >= 0 ? rowValues[statusIdx] : ''

          const fullName = excelCellToString(fullNameVal).trim()
          const email = excelCellToString(emailVal).trim()
          const status = excelCellToString(statusVal).trim()

          if (!fullName && !email && !status) return

          appliedCandidates.push({
            fullName,
            email,
            status: status || 'Applied',
          })
        })

        if (appliedCandidates.length > 0) {
          rowData.appliedCandidates = appliedCandidates
        }

        // Validate and convert
        const validationResult = validateAndConvertFPTK(rowData, i, ctx)
        
        if (validationResult.valid && validationResult.fptk) {
          // Store row number in the FPTK object for error tracking
          const fptkWithRow = {
            ...validationResult.fptk,
            _rowNumber: i,
          }
          success.push(fptkWithRow as any)
        } else {
          failed.push({
            row: i,
            data: rowData,
            errors: validationResult.errors
          })
        }
      }

      return {
        success,
        failed,
        total: success.length + failed.length,
        successCount: success.length,
        failedCount: failed.length,
      }
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })()
}

const TEMPLATE_MAX_ROW = 2000

export async function generateFPTKTemplate(): Promise<void> {
  const [officeLocations, divisions] = await Promise.all([
    MasterOfficeLocationAPI.getAll().catch(() => [] as any[]),
    MasterDivisionAPI.getAll().catch(() => [] as any[]),
  ])

  const ptList = (Array.from(
    new Set((officeLocations || []).map((l: any) => (l.pt || '').toString().trim()).filter(Boolean))
  ) as string[]).sort((a, b) => a.localeCompare(b))

  const headers = [...FPTK_TEMPLATE_HEADERS]

  const examplePt = ptList[0] || ''
  const locForPt = (officeLocations || []).find((l: any) => (l.pt || '').toString().trim() === examplePt)
  const exampleArea = (locForPt as any)?.area?.toString?.() || ''
  const exampleAreaDetail = (locForPt as any)?.areaDetail?.toString?.() || ''
  const exampleDivision = divisions?.[0]?.divisionName || ''
  const exampleSection =
    divisions?.find((d: any) => d.divisionName === exampleDivision)?.sectionName || ''

  const exampleRow: (string | number)[] = [
    examplePt,
    'FKTK-001',
    'Pending',
    exampleDivision,
    exampleSection,
    'John Manager',
    'Software Engineer',
    'Contract',
    'Senior',
    'G2',
    'P0',
    '2024-12',
    'Develop and maintain software applications. Bachelor degree required.',
    'Staff',
    exampleArea,
    exampleAreaDetail,
    'Additional',
    '',
    '',
    1,
    'Pending FKTK',
    '2024-01-15',
  ]
  while (exampleRow.length < headers.length) {
    exampleRow.push('')
  }

  const workbook = new ExcelJS.Workbook()
  const listSheet = workbook.addWorksheet('_lists', { state: 'veryHidden' })

  let col = 1
  const ref: Record<string, string> = {}
  const refOrder: string[] = []

  const writeCol = (values: string[]) => {
    const c = col
    const letter = indexToColumnLetter(c - 1)
    refOrder.push(letter)
    values.forEach((v, i) => {
      listSheet.getCell(i + 1, c).value = v
    })
    ref[letter] = `'_lists'!$${letter}$1:$${letter}$${Math.max(1, values.length)}`
    col += 1
  }

  writeCol(ptList.length ? ptList : [''])
  writeCol([...FPTK_STATUS_FKTK_OPTIONS])
  writeCol([...FPTK_EMPLOYMENT_TYPE_OPTIONS])
  writeCol([...FPTK_PRIORITY_OPTIONS])
  writeCol([...FPTK_CRITERIA_OPTIONS])
  writeCol([...FPTK_ADDITIONAL_OR_REPLACEMENT_OPTIONS])
  writeCol([...FPTK_CURRENT_STATUS_OPTIONS])
  writeCol([...FPTK_APPLIED_CANDIDATE_STATUS_OPTIONS])

  const [
    ptLetter,
    statusFktkLetter,
    empLetter,
    priLetter,
    critLetter,
    addLetter,
    curLetter,
    appLetter,
  ] = refOrder

  const worksheet = workbook.addWorksheet('FPTK Template')
  worksheet.addRow(headers)
  worksheet.addRow(exampleRow)
  worksheet.columns = headers.map(() => ({ width: 26 }))

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  const hi = (name: string) => headers.indexOf(name)
  const addDv = (
    headerName: string,
    formulae: string[],
    errorText: string,
    allowBlank = false
  ) => {
    const idx = hi(headerName)
    if (idx < 0) return
    const L = indexToColumnLetter(idx)
    const range = `${L}2:${L}${TEMPLATE_MAX_ROW}`
    ;(worksheet as any).dataValidations.add(range, {
      type: 'list',
      allowBlank,
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Invalid value',
      error: errorText,
      formulae,
    })
  }

  if (ptList.length) {
    addDv('PT', [ref[ptLetter]], 'Choose a PT from Master Office Location.', false)
  }
  addDv('Status FKTK', [ref[statusFktkLetter]], `Use: ${FPTK_STATUS_FKTK_OPTIONS.join(' or ')}`, true)
  addDv('Employment Type', [ref[empLetter]], `Use: ${FPTK_EMPLOYMENT_TYPE_OPTIONS.join(', ')}`, false)
  addDv('Priority', [ref[priLetter]], `Use: ${FPTK_PRIORITY_OPTIONS.join(', ')}`, true)
  addDv('Criteria', [ref[critLetter]], `Use: ${FPTK_CRITERIA_OPTIONS.join(' or ')}`, false)
  addDv('Additional or Replacement', [ref[addLetter]], `Use: ${FPTK_ADDITIONAL_OR_REPLACEMENT_OPTIONS.join(' or ')}`, false)
  addDv('Current Status', [ref[curLetter]], `Use: ${FPTK_CURRENT_STATUS_OPTIONS.join(', ')}`, false)

  for (let n = 1; n <= FPTK_EXCEL_APPLIED_CANDIDATE_SLOT_COUNT; n++) {
    addDv(
      `Applied Candidate ${n} Status`,
      [ref[appLetter]],
      'Pick a status from the list (same options as in the Position form).',
      true
    )
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'FPTK_Template.xlsx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
