import { useRef, useState, type KeyboardEvent } from 'react'
import { UPGRADE_DEFINITIONS } from '../game/content'
import { getUpgradeCost } from '../game/formulas'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  UPGRADE_IDS,
  type CompanionId,
  type GameState,
  type SkillId,
  type UpgradeId,
} from '../game/types'
import { CompanionPanel } from './CompanionPanel'
import { SkillPanel } from './SkillPanel'
import { UpgradePanel } from './UpgradePanel'

const GROWTH_TABS = [
  { id: 'equipment', label: '장비' },
  { id: 'skill', label: '스킬' },
  { id: 'companion', label: '동료' },
] as const

type GrowthTabId = (typeof GROWTH_TABS)[number]['id']

export interface GrowthTabsProps {
  state: GameState
  onBuyUpgrade: (id: UpgradeId) => void
  onBuySkill: (id: SkillId) => void
  onRecruitCompanion: (id: CompanionId) => void
  onTrainCompanion: () => void
  disabled?: boolean
}

export function GrowthTabs({
  state,
  onBuyUpgrade,
  onBuySkill,
  onRecruitCompanion,
  onTrainCompanion,
  disabled = false,
}: GrowthTabsProps) {
  const usesDesktopTabs = useMediaQuery('(min-width: 1024px)', true)
  const [activeTab, setActiveTab] = useState<GrowthTabId>('equipment')
  const tabRefs = useRef(new Map<GrowthTabId, HTMLButtonElement>())
  const hasAffordableUpgrade = UPGRADE_IDS.some((id) => {
    const level = state.player.upgrades[id]
    return level < UPGRADE_DEFINITIONS[id].maxLevel
      && state.player.gold >= getUpgradeCost(id, level)
  })

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: GrowthTabId,
  ) => {
    const currentIndex = GROWTH_TABS.findIndex((tab) => tab.id === tabId)
    let nextIndex: number

    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + GROWTH_TABS.length) % GROWTH_TABS.length
    } else if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % GROWTH_TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = GROWTH_TABS.length - 1
    } else {
      return
    }

    event.preventDefault()
    const nextTab = GROWTH_TABS[nextIndex]
    if (nextTab === undefined) return
    setActiveTab(nextTab.id)
    tabRefs.current.get(nextTab.id)?.focus()
  }

  return (
    <section className="growth-center" aria-labelledby="growth-center-title">
      <div className="growth-center__header">
        <div>
          <p className="eyebrow">GROWTH CENTER</p>
          <h2 id="growth-center-title">성장 센터</h2>
        </div>
      </div>

      {usesDesktopTabs && (
        <div className="growth-tabs__tablist" role="tablist" aria-label="성장 메뉴">
          {GROWTH_TABS.map((tab) => {
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  if (node === null) tabRefs.current.delete(tab.id)
                  else tabRefs.current.set(tab.id, node)
                }}
                id={`growth-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`growth-tabpanel-${tab.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
              >
                <span>{tab.label}</span>
                {tab.id === 'equipment' && hasAffordableUpgrade && (
                  <span className="sr-only">강화 가능</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="progression-panels">
        <div
          id="growth-tabpanel-equipment"
          className="growth-tabpanel growth-tabpanel--equipment"
          role={usesDesktopTabs ? 'tabpanel' : undefined}
          aria-labelledby={usesDesktopTabs ? 'growth-tab-equipment' : undefined}
          data-active={!usesDesktopTabs || activeTab === 'equipment'}
        >
          <UpgradePanel state={state} onBuy={onBuyUpgrade} disabled={disabled} />
        </div>
        <div
          id="growth-tabpanel-skill"
          className="growth-tabpanel growth-tabpanel--skill"
          role={usesDesktopTabs ? 'tabpanel' : undefined}
          aria-labelledby={usesDesktopTabs ? 'growth-tab-skill' : undefined}
          data-active={!usesDesktopTabs || activeTab === 'skill'}
        >
          <SkillPanel state={state} onBuy={onBuySkill} disabled={disabled} />
        </div>
      </div>

      <div
        id="growth-tabpanel-companion"
        className="growth-tabpanel growth-tabpanel--companion"
        role={usesDesktopTabs ? 'tabpanel' : undefined}
        aria-labelledby={usesDesktopTabs ? 'growth-tab-companion' : undefined}
        data-active={!usesDesktopTabs || activeTab === 'companion'}
      >
        <CompanionPanel
          state={state}
          onRecruit={onRecruitCompanion}
          onTrain={onTrainCompanion}
          disabled={disabled}
        />
      </div>
    </section>
  )
}
