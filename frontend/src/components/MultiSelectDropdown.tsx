"use client"

import { Fragment, useMemo, useState } from 'react'
import { Popover, Transition } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'

type Option = { value: string; label?: string }

type Props = {
  label: string
  options: Array<Option | string>
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

const normalizeOptions = (options: Array<Option | string>): Option[] =>
  options.map((o) => (typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value }))

export default function MultiSelectDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Type to search...',
  className,
}: Props) {
  const [query, setQuery] = useState('')
  const normalized = useMemo(() => normalizeOptions(options), [options])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return normalized
    return normalized.filter((o) => (o.label || o.value).toLowerCase().includes(q))
  }, [normalized, query])

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v))
    else onChange([...value, v])
  }

  const selectedText = value.length === 0 ? placeholder : `${value.length} selected`

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <Popover className="relative">
        {({ open }) => (
          <>
            <Popover.Button
              className={clsx(
                'w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-left flex items-center justify-between',
                open && 'ring-2 ring-indigo-500 border-indigo-500'
              )}
            >
              <span className={clsx(value.length === 0 ? 'text-gray-400' : 'text-gray-900')}>{selectedText}</span>
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            </Popover.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-75"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <Popover.Panel className="absolute z-20 mt-2 w-full rounded-md border bg-white shadow-lg p-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                  />
                  <button
                    type="button"
                    className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                    onClick={() => onChange([])}
                  >
                    Clear
                  </button>
                </div>

                <div className="max-h-56 overflow-auto">
                  {filtered.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-gray-500">No matches.</div>
                  ) : (
                    <ul className="space-y-1">
                      {filtered.map((opt) => {
                        const checked = value.includes(opt.value)
                        return (
                          <li key={opt.value}>
                            <button
                              type="button"
                              onClick={() => toggle(opt.value)}
                              className={clsx(
                                'w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-left',
                                checked && 'bg-indigo-50'
                              )}
                            >
                              <span
                                className={clsx(
                                  'h-4 w-4 inline-flex items-center justify-center rounded border',
                                  checked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'
                                )}
                                aria-hidden="true"
                              >
                                {checked ? <span className="h-2 w-2 bg-white rounded-sm" /> : null}
                              </span>
                              <span className="text-sm text-gray-900">{opt.label ?? opt.value}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  )
}

