'use client'

import { useMemo, useState } from 'react'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'
import type { PositionOption } from '@/lib/fptkPositionOptions'

export type PositionPickerMeta = {
  totalFetched: number
  selectableCount: number
  excludedByStatusCount: number
}

interface PositionAppliedForFieldProps {
  selected: string[]
  options: PositionOption[]
  loading?: boolean
  meta?: PositionPickerMeta | null
  onChange: (titles: string[]) => void
  disabled?: boolean
  /** When false, picker prompts user to select a division first. */
  divisionSelected?: boolean
  /** Override copy when picker is not ready (e.g. TA_SITE missing PT scope). */
  pickerNotReadyMessage?: string
  /** Override copy when ready but no options match. */
  noOptionsMessage?: string
}

function matchesQuery(option: PositionOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    option.title,
    option.department,
    option.division,
    option.fptkNumber,
    option.currentStatus,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export default function PositionAppliedForField({
  selected,
  options,
  loading = false,
  meta,
  onChange,
  disabled = false,
  divisionSelected = true,
  pickerNotReadyMessage,
  noOptionsMessage,
}: PositionAppliedForFieldProps) {
  const [query, setQuery] = useState('')

  const availableOptions = useMemo(() => {
    return options.filter(
      (opt) => opt.title && !selected.includes(opt.title) && matchesQuery(opt, query)
    )
  }, [options, selected, query])

  const handleAdd = (title: string) => {
    if (!title || selected.includes(title)) return
    onChange([...selected, title])
    setQuery('')
  }

  const handleRemove = (title: string) => {
    onChange(selected.filter((t) => t !== title))
  }

  const pickerDisabled = disabled || loading || !divisionSelected

  const helperText = (() => {
    if (loading) return 'Loading positions…'
    if (!divisionSelected) {
      return pickerNotReadyMessage || 'Select a division first to see open positions'
    }
    if (options.length === 0) {
      return noOptionsMessage || 'No open positions for selected division(s)'
    }
    if (meta) {
      const parts = [`${meta.selectableCount} position${meta.selectableCount === 1 ? '' : 's'} available`]
      if (meta.excludedByStatusCount > 0) {
        parts.push(`${meta.excludedByStatusCount} hidden by status`)
      }
      return parts.join(' · ')
    }
    return `${options.length} position${options.length === 1 ? '' : 's'} available`
  })()

  const emptyOptionsMessage = (() => {
    if (loading) return 'Loading…'
    if (!divisionSelected) return pickerNotReadyMessage || 'Select a division first'
    if (query.trim()) return 'No matching positions'
    return noOptionsMessage || 'No open positions for selected division(s)'
  })()

  const inputPlaceholder = (() => {
    if (loading) return 'Loading positions…'
    if (!divisionSelected) return pickerNotReadyMessage || 'Select a division first'
    return 'Search position to add…'
  })()

  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '8px',
        }}
      >
        Position Applied For
      </label>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          minHeight: '60px',
          padding: '8px',
          border: '1px solid #D1D5DB',
          borderRadius: '6px',
          backgroundColor: '#fff',
        }}
      >
        {selected.length === 0 ? (
          <span style={{ fontSize: '14px', color: '#9CA3AF', fontStyle: 'italic' }}>
            No positions selected
          </span>
        ) : (
          selected.map((position) => (
            <span
              key={position}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              {position}
              <button
                type="button"
                onClick={() => handleRemove(position)}
                disabled={disabled}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#4F46E5',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                  opacity: disabled ? 0.5 : 1,
                }}
                aria-label={`Remove ${position}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div style={{ marginTop: '8px', position: 'relative' }}>
        <Combobox
          value={null}
          onChange={(option: PositionOption | null) => {
            if (option?.title) handleAdd(option.title)
          }}
          disabled={pickerDisabled}
        >
          <ComboboxInput
            className="w-full"
            displayValue={() => query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={inputPlaceholder}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              opacity: pickerDisabled ? 0.6 : 1,
            }}
            autoComplete="off"
          />
          <ComboboxOptions
            style={{
              position: 'absolute',
              zIndex: 50,
              marginTop: '4px',
              maxHeight: '240px',
              width: '100%',
              overflow: 'auto',
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#fff',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            }}
          >
            {availableOptions.length === 0 ? (
              <div
                style={{
                  padding: '10px 12px',
                  fontSize: '14px',
                  color: '#6B7280',
                }}
              >
                {emptyOptionsMessage}
              </div>
            ) : (
              availableOptions.map((opt) => (
                <ComboboxOption
                  key={opt.id}
                  value={opt}
                  className="cursor-pointer px-3 py-2.5 text-sm text-gray-900 data-focus:bg-indigo-50"
                >
                  <div className="font-medium">{opt.title}</div>
                  {(opt.division || opt.department) && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      {[opt.division, opt.department].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        </Combobox>
      </div>

      <p style={{ marginTop: '6px', fontSize: '12px', color: '#6B7280' }}>{helperText}</p>
    </div>
  )
}
