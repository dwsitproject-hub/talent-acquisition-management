'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BriefcaseIcon, ChevronDown, LogOut, ClipboardList, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { toast } from 'sonner'

export default function NavBar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await logout()
    toast.success('Signed out successfully')
    router.push('/')
  }

  return (
    <header className="bg-white shadow-sm sticky top-0 z-30">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <BriefcaseIcon className="h-8 w-8 text-primary-600" />
          <span className="text-2xl font-bold text-gray-900">KPN Careers</span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/jobs"
            className="text-gray-700 hover:text-primary-600 font-medium text-sm sm:text-base"
          >
            Browse Jobs
          </Link>

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 bg-primary-50 border border-primary-200 text-primary-700 rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary-100 transition-colors"
              >
                <User className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{user.firstName}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-gray-100 shadow-lg py-1 z-40">
                  <div className="px-4 py-2 border-b border-gray-50">
                    <p className="text-sm font-semibold text-gray-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/applications"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ClipboardList className="h-4 w-4 text-gray-400" aria-hidden />
                    My Applications
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-gray-700 hover:text-primary-600 font-medium text-sm sm:text-base"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 font-medium text-sm sm:text-base"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
