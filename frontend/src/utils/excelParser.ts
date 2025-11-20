import * as XLSX from 'xlsx'

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

        // Convert worksheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        if (jsonData.length < 2) {
          reject(new Error('Excel file must have at least 2 rows (header and data)'))
          return
        }

        // Get headers (first row)
        const headers = jsonData[0] as string[]
        
        // Get data (second row, or find the first non-empty data row)
        let dataRow = jsonData[1] as any[]
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[]
          if (row && row.some(cell => cell && cell.toString().trim() !== '')) {
            dataRow = row
            break
          }
        }

        if (!dataRow) {
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
                value = value.toString().trim()
                
                // Handle date formatting
                if (fieldKey === 'dateOfBirth' && value) {
                  // Try to parse Excel date serial number
                  if (typeof dataRow[index] === 'number') {
                    const excelDate = XLSX.SSF.parse_date_code(dataRow[index])
                    if (excelDate) {
                      value = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`
                    }
                  }
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
    }

    reader.onerror = () => {
      reject(new Error('Failed to read the file'))
    }

    reader.readAsBinaryString(file)
  })
}

export function validateExcelFile(file: File): boolean {
  const validExtensions = ['.xlsx', '.xls']
  const fileName = file.name.toLowerCase()
  
  return validExtensions.some(ext => fileName.endsWith(ext))
}
