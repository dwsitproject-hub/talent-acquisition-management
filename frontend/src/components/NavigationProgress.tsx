'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * Renders a thin indigo progress bar at the very top of the viewport while
 * navigating between pages.  Strategy:
 *   1. A click listener on `document` fires when any internal <a> is clicked.
 *      The bar starts at ~20 % and slowly crawls toward 90 %.
 *   2. When `usePathname` reports a new value the navigation is complete –
 *      the bar jumps to 100 % then fades out.
 */
export default function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)

  const crawlTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPath = useRef(pathname)

  const clearTimers = () => {
    if (crawlTimer.current) clearInterval(crawlTimer.current)
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }

  const startProgress = () => {
    clearTimers()
    setVisible(true)
    setWidth(20)
    crawlTimer.current = setInterval(() => {
      setWidth((w) => {
        if (w >= 88) return w
        return w + Math.random() * 8
      })
    }, 350)
  }

  const completeProgress = () => {
    clearTimers()
    setWidth(100)
    hideTimer.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 350)
  }

  // Start bar on internal link click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/.test(href)) return
      if (anchor.target === '_blank') return
      startProgress()
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Complete bar when pathname changes
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      completeProgress()
    }
  }, [pathname])

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-0.5 pointer-events-none"
    >
      <div
        className="h-full bg-indigo-500 transition-[width] duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
