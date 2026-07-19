import { useRef, type KeyboardEvent } from 'react'
import type { LayoutMode } from '../hooks/useLayoutPreference'

const LAYOUT_OPTIONS = [
  { value: 'dashboard', label: '유형 1 · 대시보드' },
  { value: 'tactical', label: '유형 2 · 전술 전장' },
] as const satisfies readonly {
  value: LayoutMode
  label: string
}[]

export interface LayoutModeSelectorProps {
  value: LayoutMode
  onChange: (value: LayoutMode) => void
}

export function LayoutModeSelector({
  value,
  onChange,
}: LayoutModeSelectorProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const selectAt = (index: number) => {
    const option = LAYOUT_OPTIONS[index]
    if (option === undefined) return
    if (option.value !== value) onChange(option.value)
    optionRefs.current[index]?.focus()
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + LAYOUT_OPTIONS.length) % LAYOUT_OPTIONS.length
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % LAYOUT_OPTIONS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = LAYOUT_OPTIONS.length - 1
    } else {
      return
    }

    event.preventDefault()
    selectAt(nextIndex)
  }

  return (
    <div
      className="layout-mode-selector"
      role="radiogroup"
      aria-label="화면 레이아웃"
      aria-orientation="horizontal"
      data-testid="layout-mode-selector"
    >
      {LAYOUT_OPTIONS.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              optionRefs.current[index] = node
            }}
            type="button"
            className="layout-mode-selector__option"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-layout-mode={option.value}
            onClick={() => {
              if (!selected) onChange(option.value)
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
