import { Page } from '@playwright/test'

export async function seedLocalStorage(page: Page) {
  await page.addInitScript(() => {
    // Master Division
    const masterDivisions = [
      { id: 'div-1', divisionName: 'Engineering', sectionName: 'Platform', headOfDivisionName: 'Alice' },
      { id: 'div-2', divisionName: 'Commercial', sectionName: 'Sales Ops', headOfDivisionName: 'Bob' }
    ]
    localStorage.setItem('masterDivisions', JSON.stringify(masterDivisions))

    // Master Office Location
    const masterOfficeLocations = [
      { id: 'loc-1', area: 'HO', areaDetail: 'Jakarta A' },
      { id: 'loc-2', area: 'Site', areaDetail: 'Kalimantan B' }
    ]
    localStorage.setItem('masterOfficeLocations', JSON.stringify(masterOfficeLocations))

    // Candidates
    const candidates = [
      {
        id: 'cand-1', personalInfo: { firstName: 'Jane', lastName: 'Doe' },
        contactInfo: { email: 'jane@example.com', phone: '000' },
        professionalInfo: { currentPosition: 'Engineer', experience: 4, skills: ['React', 'Node'] },
        yearsOfExperience: '4', skills: ['React','Node'], division: ['Engineering'],
        positionAppliedFor: ['Senior Software Engineer'],
        applicationInfo: { appliedDate: new Date().toISOString(), source: 'Manual', status: 'new' },
        status: 'new', source: 'Manual', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }
    ]
    localStorage.setItem('candidates', JSON.stringify(candidates))

    // Job Postings
    const now = new Date().toISOString()
    const jobPostings = [
      {
        id: 'jp-1', title: 'Senior Software Engineer', department: 'Engineering', division: 'Engineering',
        section: 'Platform', hiringManager: 'HM', type: 'contract', level: 'L2', grade2: 'G2',
        location: 'Head Office', area: 'HO', areaDetail: 'Jakarta A', urgentNormal: 'Urgent',
        description: 'Build stuff', criteria: 'Staff', skills: ['React','Node'], yearsOfExperience: '3',
        statusFktk: 'Pending', status: 'Raise FPTK', requestDate: new Date().toISOString(),
        milestones: [{ status: 'Raise FPTK', startDate: now, endDate: null, updatedAt: now, updatedBy: 'System' }],
        createdAt: now, updatedAt: now
      }
    ]
    localStorage.setItem('jobPostings', JSON.stringify(jobPostings))

    // Pretend authenticated for app pages (token presence is checked)
    localStorage.setItem('authToken', 'test-token')
  })
}


