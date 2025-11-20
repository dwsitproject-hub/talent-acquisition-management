import * as XLSX from 'xlsx'
import { FPTK, JobType, FPTKStatus, Priority } from '@/types'

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

const VALID_PRIORITIES = ['P0', 'P1', 'P2']
const VALID_EMPLOYMENT_TYPES = ['Kontrak', 'Probation', 'Full-time', 'Fulltime', 'Part-time', 'Parttime', 'Contract']
const VALID_ADDITIONAL_OR_REPLACEMENT = ['Additional', 'Replacement', 'Additional/Replacement']

function validateAndConvertFPTK(row: FPTKExcelRow, rowNumber: number): { valid: boolean; errors: string[]; fptk?: FPTK } {
  const errors: string[] = []
  
  // Required fields
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

  // Validate Priority (P0, P1, P2) - store the original value, not mapped
  let priorityValue: Priority = 'medium'
  let priorityOriginalValue = '' // Store original P0/P1/P2 value
  if (row.priority) {
    const priorityStr = row.priority.toString().trim().toUpperCase()
    if (VALID_PRIORITIES.includes(priorityStr)) {
      // Store the original value (P0, P1, P2)
      priorityOriginalValue = priorityStr
      // Map P0, P1, P2 to FPTK priority levels for legacy compatibility
      priorityValue = priorityStr === 'P0' ? 'urgent' : 
                      priorityStr === 'P1' ? 'high' : 
                      priorityStr === 'P2' ? 'medium' : 'low'
    } else {
      // If not a valid priority, still store the original value
      priorityOriginalValue = row.priority.toString().trim()
    }
  }

  // Validate Employment Type
  let jobType: JobType = 'full-time'
  if (row.employmentType) {
    const empTypeStr = row.employmentType.toString().trim()
    if (empTypeStr === 'Kontrak' || empTypeStr.toLowerCase() === 'contract') {
      jobType = 'contract'
    } else if (empTypeStr === 'Probation' || empTypeStr.toLowerCase().includes('fulltime') || empTypeStr.toLowerCase().includes('full-time')) {
      jobType = 'full-time'
    } else if (empTypeStr.toLowerCase().includes('parttime') || empTypeStr.toLowerCase().includes('part-time')) {
      jobType = 'part-time'
    } else {
      errors.push(`Invalid Employment Type: ${row.employmentType}. Should be one of: Kontrak, Probation, Full-time, Part-time`)
    }
  }

  // Validate Additional or Replacement
  if (row.additionalOrReplacement && !VALID_ADDITIONAL_OR_REPLACEMENT.includes(row.additionalOrReplacement.toString().trim())) {
    errors.push(`Invalid Additional or Replacement: ${row.additionalOrReplacement}. Must be one of: ${VALID_ADDITIONAL_OR_REPLACEMENT.join(', ')}`)
  }

  // Validate Current Status - use the value from Column U "Current Status" directly
  let status: FPTKStatus = 'draft'
  // Use currentStatus from Excel directly, don't override with statusFktk
  let currentStatus = row.currentStatus?.toString().trim() || 'Raise FPTK'
  
  // Only map status enum if currentStatus is provided
  if (row.currentStatus) {
    const statusStr = row.currentStatus.toString().toLowerCase().trim()
    const validStatuses: FPTKStatus[] = ['draft', 'approved', 'open', 'partially_filled', 'filled', 'cancelled', 'expired']
    if (validStatuses.includes(statusStr as FPTKStatus)) {
      status = statusStr as FPTKStatus
    } else {
      // Map common status strings to enum values for status field
      const statusMap: Record<string, FPTKStatus> = {
        'raise fptk': 'draft',
        'raise': 'draft',
        'open': 'open',
        'active': 'open',
        'closed': 'filled',
        'canceled': 'cancelled',
        'cancelled': 'cancelled',
        'signing': 'approved',
        'on boarding': 'approved',
        'cv hunting (sourcing candidate)': 'open',
        'cv hunting': 'open',
        'sourcing candidate': 'open',
      }
      status = statusMap[statusStr] || 'draft'
    }
  } else {
    // If no currentStatus provided, default to 'Raise FPTK'
    currentStatus = 'Raise FPTK'
  }

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
    employmentType: row.employmentType?.toString().trim() || '',
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
  }

  return { valid: true, errors: [], fptk: fptkWithExtra as any }
}

export function parseFPTKExcelFile(file: File): Promise<FPTKUploadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          reject(new Error('Failed to read file'))
          return
        }

        // Parse the Excel file
        const workbook = XLSX.read(data, { type: 'binary' })
        
        // Get the first worksheet
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        if (!worksheet) {
          reject(new Error('No worksheet found in the Excel file'))
          return
        }

        // Convert worksheet to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
        
        if (jsonData.length < 2) {
          reject(new Error('Excel file must have at least 2 rows (header and data)'))
          return
        }

        // Get headers (first row) and normalize them for case-insensitive matching
        const headers = (jsonData[0] as any[]).map((h: any) => h?.toString().trim() || '')
        
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

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[]
          
          // Skip empty rows
          if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
            continue
          }

          // Map row data to FPTKExcelRow using normalized header mapping
          const rowData: FPTKExcelRow = {}
          headers.forEach((header, index) => {
            const normalized = header.toLowerCase().trim()
            const mapping = headerMapping[normalized]
            if (mapping && row[index] !== undefined && row[index] !== null && row[index] !== '') {
              let value = row[index]
              
              // Handle priorityByMonthYear - if it's a number (Excel date serial), convert to text format
              if (mapping.fieldKey === 'priorityByMonthYear' && typeof value === 'number') {
                try {
                  // Excel date serial number to date
                  const excelDate = XLSX.SSF.parse_date_code(value)
                  if (excelDate) {
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                      'July', 'August', 'September', 'October', 'November', 'December']
                    const month = monthNames[excelDate.m - 1] || 'Unknown'
                    const year = String(excelDate.y).slice(-2) // Last 2 digits of year
                    value = `${month}-${year}`
                  } else {
                    // If parsing fails, just convert to string
                    value = value.toString()
                  }
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
                    const excelDate = XLSX.SSF.parse_date_code(value)
                    if (excelDate) {
                      const date = new Date(excelDate.y, excelDate.m - 1, excelDate.d)
                      value = date.toISOString().split('T')[0] // YYYY-MM-DD format
                    } else {
                      // If parsing fails, use today's date
                      value = new Date().toISOString().split('T')[0]
                    }
                  } catch (e) {
                    // If conversion fails, use today's date
                    value = new Date().toISOString().split('T')[0]
                  }
                } else if (!value || value.toString().trim() === '') {
                  // If empty, set to today's date
                  value = new Date().toISOString().split('T')[0]
                }
              }
              
              rowData[mapping.fieldKey] = value
            }
          })

          // Validate and convert
          const validationResult = validateAndConvertFPTK(rowData, i + 1)
          
          if (validationResult.valid && validationResult.fptk) {
            // Store row number in the FPTK object for error tracking
            const fptkWithRow = {
              ...validationResult.fptk,
              _rowNumber: i + 1,
            }
            success.push(fptkWithRow as any)
          } else {
            failed.push({
              row: i + 1,
              data: rowData,
              errors: validationResult.errors
            })
          }
        }

        resolve({
          success,
          failed,
          total: success.length + failed.length,
          successCount: success.length,
          failedCount: failed.length
        })
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read the file'))
    }

    reader.readAsBinaryString(file)
  })
}

export function generateFPTKTemplate(): void {
  const headers = [
    'PT',
    'No FKTK',
    'Status FKTK',
    'Division',
    'Section',
    'Hiring Manager',
    'Position',
    'Employment Type',
    'Type Grade',
    'Grade2',
    'Priority',
    'Priority by month-year',
    'Job Specification and Qualifications',
    'Criteria',
    'Area',
    'Area Detail',
    'Additional or Replacement',
    'Replacement Name',
    'Resign Reason',
    'Total Request',
    'Current Status',
    'Request Date'
  ]

  const exampleRow = [
    'PT ABC',
    'FKTK-001',
    'Active',
    'Engineering',
    'IT',
    'John Manager',
    'Software Engineer',
    'Kontrak',
    'Senior',
    'Grade 2',
    'P0',
    '2024-12',
    'Develop and maintain software applications. Bachelor degree required.',
    'Technical',
    'HO',
    'Jakarta',
    'Additional',
    '',
    '',
    '1',
    'draft',
    '2024-01-15'
  ]

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'FPTK Template')

  // Set column widths
  const colWidths = headers.map(() => ({ wch: 25 }))
  worksheet['!cols'] = colWidths

  // Generate file and download
  XLSX.writeFile(workbook, 'FPTK_Template.xlsx')
}
