import { useRef, type KeyboardEvent } from 'react'
import type { GameMode } from '../game/types'
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
  gameMode?: GameMode
  onGameModeChange?: (mode: GameMode) => void
  gameModeDisabled?: boolean
}

export function LayoutModeSelector({
  value,
  onChange,
  gameMode,
  onGameModeChange,
  gameModeDisabled = false,
}: LayoutModeSelectorProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const options = gameMode === undefined
    ? LAYOUT_OPTIONS
    : [
        ...LAYOUT_OPTIONS,
        { value: 'camp', label: '캠프 · 관리' } as const,
      ]
  const selectedValue = gameMode === 'CAMP' ? 'camp' : value

  const isUnavailable = (option: (typeof options)[number]) => {
    const requiresModeChange = option.value === 'camp'
      ? gameMode !== 'CAMP'
      : gameMode === 'CAMP'
    return Boolean(requiresModeChange && gameModeDisabled)
  }

  const selectAt = (index: number) => {
    const option = options[index]
    if (option === undefined) return
    if (isUnavailable(option)) return
    if (option.value === 'camp') {
      if (gameMode !== 'CAMP') onGameModeChange?.('CAMP')
    } else {
      if (option.value !== value) onChange(option.value)
      if (gameMode === 'CAMP') onGameModeChange?.('BATTLE')
    }
    optionRefs.current[index]?.focus()
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number
    let direction: 1 | -1
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      direction = -1
      nextIndex = (index - 1 + options.length) % options.length
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      direction = 1
      nextIndex = (index + 1) % options.length
    } else if (event.key === 'Home') {
      direction = 1
      nextIndex = 0
    } else if (event.key === 'End') {
      direction = -1
      nextIndex = options.length - 1
    } else {
      return
    }

    event.preventDefault()
    for (let checked = 0; checked < options.length; checked += 1) {
      const option = options[nextIndex]
      if (option !== undefined && !isUnavailable(option)) break
      nextIndex = (nextIndex + direction + options.length) % options.length
    }
    selectAt(nextIndex)
  }

  return (
    <div
      className="layout-mode-selector"
      role="radiogroup"
      aria-label={gameMode === undefined ? '화면 레이아웃' : '전투 및 캠프 화면'}
      aria-orientation="horizontal"
      data-testid="layout-mode-selector"
      data-option-count={options.length}
    >
      {options.map((option, index) => {
        const selected = option.value === selectedValue
        const unavailable = isUnavailable(option)
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
            aria-disabled={unavailable || undefined}
            tabIndex={selected ? 0 : -1}
            data-layout-mode={option.value === 'camp' ? undefined : option.value}
            data-game-mode={option.value === 'camp' ? 'CAMP' : 'BATTLE'}
            onClick={() => {
              if (!selected && !unavailable) selectAt(index)
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
