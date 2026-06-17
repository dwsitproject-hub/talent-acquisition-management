'use client'

import { useEffect, useState } from 'react'
import { TasGuidedTour } from '@/components/tour/TasGuidedTour'
import Header from './Header'
import Sidebar from './Sidebar'
import NavigationProgress from '@/components/NavigationProgress'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebarCollapsed')
    if (stored === 'true') setSidebarCollapsed(true)
  }, [])

  const handleSetSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
    localStorage.setItem('sidebarCollapsed', String(collapsed))
  }

  return (
    <div>
      <NavigationProgress />
      <TasGuidedTour />
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={handleSetSidebarCollapsed}
      />

      <div className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72'
      )}>
        <Header setSidebarOpen={setSidebarOpen} />

        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
