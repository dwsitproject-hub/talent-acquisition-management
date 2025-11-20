'use client'

import { useEffect, useState } from 'react'

export default function MigrateLocalStoragePage() {
  const [exportedData, setExportedData] = useState<string>('')

  const exportData = () => {
    const keys = [
      'candidates',
      'jobPostings',
      'masterDivisions',
      'masterOfficeLocations',
      'teamMembers',
      'applications',
      'openPositionLogs',
      'menuAccess'
    ]
    
    const data: any = {}
    keys.forEach(key => {
      const value = localStorage.getItem(key)
      if (value) {
        try {
          data[key] = JSON.parse(value)
        } catch (e) {
          data[key] = value
        }
      }
    })
    
    const json = JSON.stringify(data, null, 2)
    setExportedData(json)
  }

  const downloadData = () => {
    if (!exportedData) {
      exportData()
      return
    }
    
    const blob = new Blob([exportedData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'localStorage-export.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    exportData()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Export LocalStorage Data for Migration
          </h1>
          
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">
              This page exports localStorage data to JSON format for database migration.
            </p>
            <p className="text-sm text-gray-700">
              Click "Export All Data" to generate the JSON file, then copy it to{' '}
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">backend/data/localStorage-export.json</code>
            </p>
          </div>
          
          <div className="flex gap-2 mb-6">
            <button
              onClick={exportData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Export All Data
            </button>
            <button
              onClick={downloadData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Download JSON File
            </button>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Exported Data:</h3>
            <textarea
              value={exportedData}
              readOnly
              className="w-full h-96 font-mono text-xs p-4 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

