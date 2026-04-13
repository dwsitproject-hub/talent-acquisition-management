import ExcelJS from 'exceljs'

export interface ParsedFormData {
  fullName: string
  position: string
  placeOfBirth: string
  dateOfBirth: string
  gender: string
  ethnicity: string
  maritalStatus: string
  height: string
  weight: string
  idNumber: string
  taxNumber: string
  bpjsNumber: string
  healthStatus: string
  drivingLicense: string
  bloodType: string
  currentAddress: string
  permanentAddress: string
  phone: string
  email: string
}

// Field mapping from Excel column names to our form fields
const FIELD_MAPPING: Record<string, keyof ParsedFormData> = {
  // Personal Information
  'Nama Lengkap': 'fullName',
  'Nama': 'fullName',
  'Full Name': 'fullName',
  'Posisi': 'position',
  'Position': 'position',
  'Jabatan': 'position',
  'Tempat Lahir': 'placeOfBirth',
  'Place of Birth': 'placeOfBirth',
  'Tanggal Lahir': 'dateOfBirth',
  'Date of Birth': 'dateOfBirth',
  'Jenis Kelamin': 'gender',
  'Gender': 'gender',
  'Suku': 'ethnicity',
  'Ethnicity': 'ethnicity',
  'Status PTKP': 'maritalStatus',
  'PTKP': 'maritalStatus',
  'Marital Status': 'maritalStatus',
  'Tinggi': 'height',
  'Height': 'height',
  'Berat': 'weight',
  'Weight': 'weight',
  'No KTP': 'idNumber',
  'KTP': 'idNumber',
  'ID Number': 'idNumber',
  'No NPWP': 'taxNumber',
  'NPWP': 'taxNumber',
  'Tax Number': 'taxNumber',
  'No BPJS': 'bpjsNumber',
  'BPJS': 'bpjsNumber',
  'BPJS Number': 'bpjsNumber',
  'Status Kesehatan': 'healthStatus',
  'Health Status': 'healthStatus',
  'SIM': 'drivingLicense',
  'Driving License': 'drivingLicense',
  'Golongan Darah': 'bloodType',
  'Blood Type': 'bloodType',
  'Alamat Sekarang': 'currentAddress',
  'Current Address': 'currentAddress',
  'Alamat Tetap': 'permanentAddress',
  'Permanent Address': 'permanentAddress',
  'No HP': 'phone',
  'Phone': 'phone',
  'Telepon': 'phone',
  'Email': 'email'
}

export function parseExcelFile(file: File): Promise<ParsedFormData> {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(arrayBuffer)
      
      // Get the first worksheet
      const worksheet = workbook.worksheets[0]
      
      if (!worksheet) {
        reject(new Error('No worksheet found in the Excel file'))
        return
      }

      // Get headers (first row)
      const headerRow = worksheet.getRow(1)
      const headers: string[] = []
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cell.value?.toString() || ''
      })
      
      if (headers.length === 0) {
        reject(new Error('No headers found in the Excel file'))
        return
      }

      // Get data (second row, or find the first non-empty data row)
      let dataRow: any[] = []
      let dataRowIndex = -1
      
      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i)
        const rowValues: any[] = []
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowValues[colNumber - 1] = cell.value
        })
        
        if (rowValues.some(cell => cell && cell.toString().trim() !== '')) {
          dataRow = rowValues
          dataRowIndex = i
          break
        }
      }

      if (dataRow.length === 0) {
        reject(new Error('No data found in the Excel file'))
        return
      }

      // Map the data to our form fields
      const parsedData: Partial<ParsedFormData> = {}
      
      headers.forEach((header, index) => {
        if (header && typeof header === 'string') {
          const cleanHeader = header.trim()
          const fieldKey = FIELD_MAPPING[cleanHeader]
          
          if (fieldKey && dataRow[index] !== undefined) {
            let value = dataRow[index]
            
            // Convert to string and clean up
            if (value !== null && value !== undefined) {
              // Handle date formatting
              if (fieldKey === 'dateOfBirth' && value) {
                // ExcelJS handles dates as Date objects or Excel serial numbers
                if (value instanceof Date) {
                  value = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
                } else if (typeof value === 'number') {
                  // Excel serial date: days since 1900-01-01
                  const excelEpoch = new Date(1899, 11, 30) // Excel epoch is 1899-12-30
                  const date = new Date(excelEpoch.getTime() + value * 86400000)
                  value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                } else {
                  value = value.toString().trim()
                }
              } else {
                value = value.toString().trim()
              }
              
              // Handle gender mapping
              if (fieldKey === 'gender') {
                const genderMap: Record<string, string> = {
                  'L': 'Laki-laki',
                  'P': 'Perempuan',
                  'Male': 'Laki-laki',
                  'Female': 'Perempuan',
                  'Laki-laki': 'Laki-laki',
                  'Perempuan': 'Perempuan'
                }
                value = genderMap[value] || value
              }
              
              // Handle health status mapping
              if (fieldKey === 'healthStatus') {
                const healthMap: Record<string, string> = {
                  'Sehat': 'Sehat',
                  'Tidak Sehat': 'Tidak Sehat',
                  'Healthy': 'Sehat',
                  'Unhealthy': 'Tidak Sehat'
                }
                value = healthMap[value] || value
              }
              
              parsedData[fieldKey] = value
            }
          }
        }
      })

      // Convert to ParsedFormData with defaults
      const result: ParsedFormData = {
        fullName: parsedData.fullName || '',
        position: parsedData.position || '',
        placeOfBirth: parsedData.placeOfBirth || '',
        dateOfBirth: parsedData.dateOfBirth || '',
        gender: parsedData.gender || '',
        ethnicity: parsedData.ethnicity || '',
        maritalStatus: parsedData.maritalStatus || '',
        height: parsedData.height || '',
        weight: parsedData.weight || '',
        idNumber: parsedData.idNumber || '',
        taxNumber: parsedData.taxNumber || '',
        bpjsNumber: parsedData.bpjsNumber || '',
        healthStatus: parsedData.healthStatus || '',
        drivingLicense: parsedData.drivingLicense || '',
        bloodType: parsedData.bloodType || '',
        currentAddress: parsedData.currentAddress || '',
        permanentAddress: parsedData.permanentAddress || '',
        phone: parsedData.phone || '',
        email: parsedData.email || ''
      }

      resolve(result)
    } catch (error) {
      reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`))
    }
  })
}

export function validateExcelFile(file: File): boolean {
  const validExtensions = ['.xlsx', '.xls']
  const fileName = file.name.toLowerCase()
  
  return validExtensions.some(ext => fileName.endsWith(ext))
}
