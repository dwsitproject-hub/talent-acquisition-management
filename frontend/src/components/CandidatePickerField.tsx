'use client'

import { useMemo, useState } from 'react'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'

export type CandidatePickerOption = {
  id: string
  fullName?: string
  name?: string
  email?: string
  yearsOfExperience?: number
  experience?: number
  skills?: string[]
  [key: string]: unknown
}

function displayName(option: CandidatePickerOption): string {
  return (
    option.fullName ||
    option.name ||
    'Unknown Candidate'
  )
}

function matchesCandidateQuery(option: CandidatePickerOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [displayName(option), option.email]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

type Props = {
  candidates: CandidatePickerOption[]
  appliedCandidateIds: string[]
  onAdd: (candidate: CandidatePickerOption) => void
  loading?: boolean
  disabled?: boolean
}

export default function CandidatePickerField({
  candidates,
  appliedCandidateIds,
  onAdd,
  loading = false,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState('')

  const appliedSet = useMemo(
    () => new Set(appliedCandidateIds.filter(Boolean)),
    [appliedCandidateIds]
  )

  const availableOptions = useMemo(() => {
    return candidates
      .filter(
        (c) =>
          c.id &&
          !appliedSet.has(c.id) &&
          matchesCandidateQuery(c, query)
      )
      .slice(0, 50)
  }, [candidates, appliedSet, query])

  const helperText = (() => {
    if (loading) return 'Loading candidates…'
    const addable = candidates.filter((c) => c.id && !appliedSet.has(c.id)).length
    if (addable === 0) return 'No more candidates to add'
    return `${addable} candidate${addable === 1 ? '' : 's'} available to add`
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
        Add candidate to this position
      </label>
      <div style={{ position: 'relative' }}>
        <Combobox
          value={null}
          onChange={(option: CandidatePickerOption | null) => {
            if (option?.id) {
              onAdd(option)
              setQuery('')
            }
          }}
          disabled={disabled || loading}
        >
          <ComboboxInput
            className="w-full"
            displayValue={() => query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={loading ? 'Loading candidates…' : 'Search by name or email…'}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              opacity: loading || disabled ? 0.6 : 1,
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
                {loading ? 'Loading…' : query.trim() ? 'No matching candidates' : 'Type to search candidates'}
              </div>
            ) : (
              availableOptions.map((opt) => (
                <ComboboxOption
                  key={opt.id}
                  value={opt}
                  className="cursor-pointer px-3 py-2.5 text-sm text-gray-900 data-focus:bg-indigo-50"
                >
                  <div className="font-medium">{displayName(opt)}</div>
                  {opt.email ? (
                    <div className="mt-0.5 text-xs text-gray-500">{opt.email}</div>
                  ) : null}
                  {(opt.yearsOfExperience ?? opt.experience) != null ? (
                    <div className="mt-0.5 text-xs text-gray-500">
                      Experience: {opt.yearsOfExperience ?? opt.experience} years
                    </div>
                  ) : null}
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
