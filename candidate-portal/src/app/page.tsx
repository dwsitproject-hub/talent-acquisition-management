import Link from 'next/link'
import { BriefcaseIcon, UserIcon, TrendingUpIcon } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BriefcaseIcon className="h-8 w-8 text-primary-600" />
            <span className="text-2xl font-bold text-gray-900">KPN Careers</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/jobs"
              className="text-gray-700 hover:text-primary-600 font-medium"
            >
              Browse Jobs
            </Link>
            <Link
              href="/login"
              className="text-gray-700 hover:text-primary-600 font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium"
            >
              Register
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Join KPN Corporation
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Discover exciting career opportunities and be part of our innovative team.
            Apply online and track your application status in real-time.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/jobs"
              className="bg-primary-600 text-white px-8 py-3 rounded-lg hover:bg-primary-700 font-medium text-lg"
            >
              Browse Open Positions
            </Link>
            <Link
              href="/register"
              className="bg-white text-primary-600 border-2 border-primary-600 px-8 py-3 rounded-lg hover:bg-primary-50 font-medium text-lg"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-primary-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <BriefcaseIcon className="h-6 w-6 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Easy Application
            </h3>
            <p className="text-gray-600">
              Apply to multiple positions with a single profile. Upload your CV and documents once.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-primary-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <TrendingUpIcon className="h-6 w-6 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Track Progress
            </h3>
            <p className="text-gray-600">
              Monitor your application status in real-time and receive notifications at every stage.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-primary-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <UserIcon className="h-6 w-6 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Personal Dashboard
            </h3>
            <p className="text-gray-600">
              Manage your profile, applications, and upcoming interviews all in one place.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Your Journey?
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Create your account today and apply for your dream job at KPN.
          </p>
          <Link
            href="/register"
            className="bg-white text-primary-600 px-8 py-3 rounded-lg hover:bg-gray-100 font-medium text-lg inline-block"
          >
            Get Started Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2024 KPN Corporation. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

