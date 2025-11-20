import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function generateFormDataDiriPDF(formData: any, candidateName: string, submittedAt?: string) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPosition = 20
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return 'Not specified'
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString
      if (isNaN(date.getTime())) return 'Not specified'
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'Not specified'
    }
  }

  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('FORM DATA DIRI', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Candidate: ${formData.fullName || candidateName || 'N/A'}`, margin, yPosition)
  yPosition += 7
  if (submittedAt) {
    doc.text(`Submitted: ${formatDate(submittedAt)}`, margin, yPosition)
    yPosition += 7
  }
  yPosition += 5

  // Personal Information
  checkNewPage(30)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('PERSONAL INFORMATION', margin, yPosition)
  yPosition += 8

  const personalInfo = [
    ['Full Name', formData.fullName || '-'],
    ['Place of Birth', formData.placeOfBirth || '-'],
    ['Date of Birth', formData.dateOfBirth || '-'],
    ['Gender', formData.gender || '-'],
    ['Ethnicity', formData.ethnicity || '-'],
    ['Marital Status', formData.maritalStatus || '-'],
    ['Height (cm)', formData.height || '-'],
    ['Weight (kg)', formData.weight || '-'],
    ['ID Number (KTP)', formData.idNumber || '-'],
    ['Tax Number (NPWP)', formData.taxNumber || '-'],
    ['BPJS Number', formData.bpjsNumber || '-'],
    ['Health Status', formData.healthStatus || '-'],
    ['Driving License', formData.drivingLicense || '-'],
    ['Blood Type', formData.bloodType || '-'],
    ['Phone Number', formData.phoneNumber || '-'],
    ['Email', formData.email || '-'],
  ]

  autoTable(doc, {
    startY: yPosition,
    head: [['Field', 'Value']],
    body: personalInfo,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 120 } },
    margin: { left: margin, right: margin }
  })
  yPosition = (doc as any).lastAutoTable.finalY + 10

  // Addresses
  checkNewPage(20)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Current Address:', margin, yPosition)
  yPosition += 6
  doc.setFont('helvetica', 'normal')
  const currentAddr = doc.splitTextToSize(formData.currentAddress || '-', contentWidth)
  doc.text(currentAddr, margin, yPosition)
  yPosition += currentAddr.length * 5 + 5

  checkNewPage(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Permanent Address:', margin, yPosition)
  yPosition += 6
  doc.setFont('helvetica', 'normal')
  const permanentAddr = doc.splitTextToSize(formData.permanentAddress || '-', contentWidth)
  doc.text(permanentAddr, margin, yPosition)
  yPosition += permanentAddr.length * 5 + 10

  // Family Members
  if (formData.familyMembers && formData.familyMembers.length > 0) {
    checkNewPage(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('FAMILY MEMBERS', margin, yPosition)
    yPosition += 8

    const familyData = formData.familyMembers.map((member: any) => [
      member.relationType || '-',
      member.name || '-',
      member.gender || '-',
      member.dateOfBirth || '-',
      member.education || '-',
      member.occupation || '-'
    ])

    autoTable(doc, {
      startY: yPosition,
      head: [['Relation', 'Name', 'Gender', 'Date of Birth', 'Education', 'Occupation']],
      body: familyData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: margin, right: margin }
    })
    yPosition = (doc as any).lastAutoTable.finalY + 10
  }

  // Education
  if (formData.education && formData.education.length > 0) {
    checkNewPage(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('EDUCATION', margin, yPosition)
    yPosition += 8

    const educationData = formData.education.map((edu: any) => [
      edu.type || '-',
      `${edu.startMonth || ''}/${edu.startYear || ''} - ${edu.endMonth || 'Present'}/${edu.endYear || ''}`,
      edu.institutionName || '-',
      edu.major || '-',
      edu.place || '-',
      edu.certification || '-'
    ])

    autoTable(doc, {
      startY: yPosition,
      head: [['Type', 'Period', 'Institution', 'Major', 'Place', 'Certification']],
      body: educationData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: margin, right: margin }
    })
    yPosition = (doc as any).lastAutoTable.finalY + 10
  }

  // Languages
  if (formData.languages && formData.languages.length > 0) {
    checkNewPage(25)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('LANGUAGES', margin, yPosition)
    yPosition += 8

    const languageData = formData.languages.map((lang: any) => [
      lang.language || '-',
      lang.speaking || '-',
      lang.writing || '-'
    ])

    autoTable(doc, {
      startY: yPosition,
      head: [['Language', 'Speaking', 'Writing']],
      body: languageData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: margin, right: margin }
    })
    yPosition = (doc as any).lastAutoTable.finalY + 10
  }

  // Work Experience
  if (formData.workExperience && formData.workExperience.length > 0) {
    checkNewPage(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('WORK EXPERIENCE', margin, yPosition)
    yPosition += 8

    formData.workExperience.forEach((work: any, index: number) => {
      checkNewPage(40)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`Experience ${index + 1}: ${work.companyName || 'N/A'}`, margin, yPosition)
      yPosition += 7

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const workDetails = [
        ['Period', `${work.startMonth || ''}/${work.startYear || ''} - ${work.endMonth || 'Present'}/${work.endYear || ''}`],
        ['Company Address', work.companyAddress || '-'],
        ['Starting Position', work.startingPosition || '-'],
        ['Last Position', work.lastPosition || '-'],
        ['Starting Salary', work.startingSalary || '-'],
        ['Last Salary', work.lastSalary || '-'],
        ['Resignation Reason', work.resignationReason || '-'],
      ]

      autoTable(doc, {
        startY: yPosition,
        body: workDetails,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 130 } },
        margin: { left: margin, right: margin }
      })
      yPosition = (doc as any).lastAutoTable.finalY + 5

      if (work.jobDescription) {
        checkNewPage(15)
        doc.setFont('helvetica', 'bold')
        doc.text('Job Description:', margin, yPosition)
        yPosition += 5
        doc.setFont('helvetica', 'normal')
        const jobDesc = doc.splitTextToSize(work.jobDescription, contentWidth)
        doc.text(jobDesc, margin, yPosition)
        yPosition += jobDesc.length * 4 + 5
      }
      yPosition += 5
    })
  }

  // Other Information
  checkNewPage(50)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('OTHER INFORMATION', margin, yPosition)
  yPosition += 8

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  
  // Format source value for display
  const formatSource = (source: string) => {
    if (!source) return '-'
    const sourceMap: { [key: string]: string } = {
      'SOCIAL_MEDIA': 'Social Media',
      'LINKEDIN': 'LinkedIn',
      'JOBSTREET': 'Jobstreet',
      'REFERENCE': 'Reference'
    }
    return sourceMap[source] || source
  }
  
  const sourceDisplay = formatSource(formData.source || '')
  const sourceDetailLabel = formData.source === 'SOCIAL_MEDIA' ? 'Social Media Detail' : 
                           formData.source === 'REFERENCE' ? 'Reference Name' : ''
  
  const otherInfo = [
    ['Emergency Contact', `${formData.emergencyContactName || '-'} (${formData.emergencyRelation || '-'})`],
    ['Emergency Address', formData.emergencyContactAddress || '-'],
    ['Emergency Phone', formData.emergencyPhoneNo || '-'],
    ['Can Contact References', formData.canContactReferences ? 'Yes' : 'No'],
    ['Hobbies', formData.hobbies || '-'],
    ['Willing to Relocate', formData.willingToRelocate ? 'Yes' : 'No'],
    ['Willing to Travel', formData.willingToTravel ? 'Yes' : 'No'],
    ['Available Start Date', formData.availableStartDate || '-'],
    ['Source (Knowing us from)', sourceDisplay],
  ]
  
  // Add source detail if applicable
  if ((formData.source === 'SOCIAL_MEDIA' || formData.source === 'REFERENCE') && formData.sourceDetail) {
    otherInfo.push([sourceDetailLabel, formData.sourceDetail])
  }

  autoTable(doc, {
    startY: yPosition,
    body: otherInfo,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 120 } },
    margin: { left: margin, right: margin }
  })
  yPosition = (doc as any).lastAutoTable.finalY + 10

  if (formData.motivationToJoin) {
    checkNewPage(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Motivation to Join:', margin, yPosition)
    yPosition += 6
    doc.setFont('helvetica', 'normal')
    const motivation = doc.splitTextToSize(formData.motivationToJoin, contentWidth)
    doc.text(motivation, margin, yPosition)
    yPosition += motivation.length * 4 + 5
  }

  if (formData.expectedSalary) {
    checkNewPage(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Expected Salary & Benefits:', margin, yPosition)
    yPosition += 6
    doc.setFont('helvetica', 'normal')
    const salary = doc.splitTextToSize(formData.expectedSalary, contentWidth)
    doc.text(salary, margin, yPosition)
    yPosition += salary.length * 4 + 5
  }

  // Declaration
  checkNewPage(30)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('DECLARATION', margin, yPosition)
  yPosition += 8

  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  const declaration = doc.splitTextToSize(
    '"I hereby declare that the above information is true. If any of the information is later found to be false or contradictory, I am willing to be subject to legal action in accordance with applicable laws and to resign from the company for committing fraud."',
    contentWidth
  )
  doc.text(declaration, margin, yPosition)
  yPosition += declaration.length * 4 + 5

  doc.setFont('helvetica', 'normal')
  const accepted = (() => {
    const v = (formData as any).declarationAccepted
    if (typeof v === 'boolean') return v
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase()
      return s === 'yes' || s === 'true' || s === 'on' || s === '1'
    }
    if (typeof v === 'number') return v === 1
    return false
  })()
  doc.text(`Acceptance: ${accepted ? 'Accepted' : 'Not accepted'}`, margin, yPosition)

  // Save PDF
  const fileName = `Form_Data_Diri_${(formData.fullName || candidateName || 'Candidate').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

