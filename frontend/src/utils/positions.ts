// Mock positions data - in a real app, this would come from the backend
export const availablePositions = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'DevOps Engineer',
  'Data Scientist',
  'Data Analyst',
  'Product Manager',
  'Project Manager',
  'UI/UX Designer',
  'Graphic Designer',
  'Marketing Manager',
  'Sales Manager',
  'HR Manager',
  'Finance Manager',
  'Business Analyst',
  'Quality Assurance Engineer',
  'System Administrator',
  'Network Engineer',
  'Security Engineer',
  'Mobile Developer',
  'Database Administrator',
  'Technical Writer',
  'Customer Support Representative',
  'Operations Manager',
  'Content Manager',
  'Social Media Manager',
  'Digital Marketing Specialist',
  'SEO Specialist',
  'Accountant',
  'Legal Counsel',
  'Executive Assistant',
  'Office Manager',
  'Facilities Manager',
  'Procurement Manager',
  'Supply Chain Manager',
  'Logistics Coordinator',
  'Research Analyst',
  'Business Development Manager',
  'Partnership Manager'
]

export function getPositions() {
  return availablePositions
}

export function searchPositions(query: string) {
  return availablePositions.filter(position => 
    position.toLowerCase().includes(query.toLowerCase())
  )
}
