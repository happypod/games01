import { useRef, type KeyboardEvent } from 'react'
import type { GameMode } from '../game/types'

const GAME_MODE_OPTIONS = [
  { value: 'BATTLE', label: '전투 · 전술 전장' },
  { value: 'CAMP', label: '캠프 · 관리' },
] as const satisfies readonly {
  value: GameMode
  label: string
}[]

export interface GameModeSelectorProps {
  value: GameMode
  onChange: (value: GameMode) => void
  disabled?: boolean
}

export function GameModeSelector({
  value,
  onChange,
  disabled = false,
}: GameModeSelectorProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const isUnavailable = (optionValue: GameMode) =>
    disabled && optionValue !== value

  const selectAt = (index: number) => {
    const option = GAME_MODE_OPTIONS[index]
    if (option === undefined || isUnavailable(option.value)) return

    if (option.value !== value) onChange(option.value)
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
      nextIndex = (index - 1 + GAME_MODE_OPTIONS.length) % GAME_MODE_OPTIONS.length
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      direction = 1
      nextIndex = (index + 1) % GAME_MODE_OPTIONS.length
    } else if (event.key === 'Home') {
      direction = 1
      nextIndex = 0
    } else if (event.key === 'End') {
      direction = -1
      nextIndex = GAME_MODE_OPTIONS.length - 1
    } else {
      return
    }

    event.preventDefault()
    for (let checked = 0; checked < GAME_MODE_OPTIONS.length; checked += 1) {
      const option = GAME_MODE_OPTIONS[nextIndex]
      if (option !== undefined && !isUnavailable(option.value)) break
      nextIndex = (
        nextIndex + direction + GAME_MODE_OPTIONS.length
      ) % GAME_MODE_OPTIONS.length
    }
    selectAt(nextIndex)
  }

  return (
    <div
      className="game-mode-selector"
      role="radiogroup"
      aria-label="전투 및 캠프 화면"
      aria-orientation="horizontal"
      data-testid="game-mode-selector"
      data-option-count={GAME_MODE_OPTIONS.length}
    >
      {GAME_MODE_OPTIONS.map((option, index) => {
        const selected = option.value === value
        const unavailable = isUnavailable(option.value)

        return (
          <button
            key={option.value}
            ref={(node) => {
              optionRefs.current[index] = node
            }}
            type="button"
            className="game-mode-selector__option"
            role="radio"
            aria-checked={selected}
            aria-disabled={unavailable || undefined}
            tabIndex={selected ? 0 : -1}
            data-game-mode={option.value}
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
