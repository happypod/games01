import {
  faBagShopping,
  faBookOpen,
  faBowlFood,
  faFlask,
  faHeartPulse,
  faLock,
  faMapLocationDot,
  faUserShield,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  getBossMilestoneReward,
  hasClaimedBossMilestone,
} from '../game/bossMilestones'
import {
  getCampMaterialYield,
  getHealingPotionRecoveryAmount,
} from '../game/camp'
import {
  COMPANION_DEFINITIONS,
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  getEnemyDefinition,
} from '../game/content'
import {
  getCompanionDamage,
  getHeroStats,
  getXpToNextLevel,
  isSkillUnlocked,
} from '../game/formulas'
import { formatNumber } from '../game/format'
import {
  CAMP_CONSUMABLE_IDS,
  CAMP_MATERIAL_IDS,
  SKILL_IDS,
  UPGRADE_IDS,
  type CampConsumableId,
  type CampQuickConsumableId,
  type GameState,
} from '../game/types'
import { GameAsset } from './GameAsset'
import { StageMapPanel } from './StageMapPanel'
import { StatBar } from './StatBar'

const INTEL_TABS = [
  { id: 'map', label: '지도', icon: faMapLocationDot },
  { id: 'character', label: '캐릭터', icon: faUserShield },
  { id: 'inventory', label: '가방', icon: faBagShopping },
  { id: 'skills', label: '스킬', icon: faWandMagicSparkles },
  { id: 'bestiary', label: '도감', icon: faBookOpen },
] as const

export type TacticalIntelTabId = (typeof INTEL_TABS)[number]['id']

const MATERIAL_LABELS = {
  ashShard: '재의 파편',
  beastHide: '야수 가죽',
  emberCore: '불씨 핵',
} as const

const CONSUMABLE_DETAILS = {
  goldStew: {
    name: '황금 스튜',
    description: '1,800 전투 라운드 동안 골드 획득량 +50%',
    icon: faBowlFood,
  },
  focusTonic: {
    name: '집중 물약',
    description: '다음 보스전의 치명타 확률을 35%로 준비',
    icon: faFlask,
  },
  healingPotion: {
    name: '회복 물약',
    description: '전투 중 최대 체력의 35%를 즉시 회복',
    icon: faHeartPulse,
  },
} as const satisfies Record<CampConsumableId, {
  name: string
  description: string
  icon: typeof faFlask
}>

const BESTIARY_FIRST_STAGES = [1, 2, 3, 4, 5, 10, 20, 30] as const

export interface TacticalIntelPanelProps {
  state: GameState
  onChooseStage: (stage: number) => void
  onEquipQuickConsumable: (id: CampQuickConsumableId | null) => void
  activeTab?: TacticalIntelTabId
  onActiveTabChange?: (id: TacticalIntelTabId) => void
  disabled?: boolean
  disabledReason?: string
}

function getConsumableStatus(state: GameState, id: CampConsumableId): string {
  if (id === 'goldStew') {
    return state.camp.buffs.goldBoostRounds > 0
      ? `효과 ${formatNumber(state.camp.buffs.goldBoostRounds)}라운드 남음`
      : '준비된 효과 없음'
  }
  if (id === 'focusTonic') {
    if (state.camp.buffs.bossFocusStage === null) return '준비된 효과 없음'
    if (state.camp.buffs.bossFocusStage === 0) return '다음 보스전 준비 완료'
    return `스테이지 ${state.camp.buffs.bossFocusStage}에 적용 중`
  }
  return state.camp.quickConsumable === 'healingPotion'
    ? '빠른 슬롯 장착 중'
    : '빠른 슬롯 미장착'
}

function EnemySummary({ state }: { state: GameState }) {
  const enemy = getEnemyDefinition(state.battle.stage)
  const drops = getCampMaterialYield(enemy)
  const milestoneReward = getBossMilestoneReward(enemy.stage)
  const milestoneClaimed = milestoneReward !== null
    && hasClaimedBossMilestone(state.claimedBossMilestoneMask, enemy.stage)
  const milestoneStatus = milestoneReward === null
    ? 'ordinary'
    : milestoneClaimed
      ? 'claimed'
      : 'available'

  return (
    <section
      className="tactical-intel-panel__enemy"
      aria-labelledby="tactical-intel-enemy-title"
      data-enemy-stage={enemy.stage}
      data-milestone-status={milestoneStatus}
    >
      <header className="tactical-intel-panel__enemy-heading">
        <div>
          <p className="eyebrow">CURRENT TARGET</p>
          <h3 id="tactical-intel-enemy-title">
            {enemy.name}
            {enemy.isBoss && <span className="boss-tag">BOSS</span>}
          </h3>
        </div>
        <span>STAGE {enemy.stage}</span>
      </header>

      <div className="tactical-intel-panel__enemy-body">
        <GameAsset
          assetId={enemy.assetId}
          purpose="character"
          decorative
          fallbackLabel={enemy.isBoss ? 'B' : 'E'}
          className="tactical-intel-panel__enemy-art"
          fit="cover"
          loading="eager"
        />
        <div className="tactical-intel-panel__enemy-vitals">
          <StatBar
            label="적 체력"
            value={state.battle.enemyHp}
            maximum={enemy.maxHp}
            tone="enemy"
          />
          <dl className="tactical-intel-panel__stat-grid">
            <div><dt>공격력</dt><dd>{formatNumber(enemy.attack)}</dd></div>
            <div><dt>골드</dt><dd>{formatNumber(enemy.goldReward)}</dd></div>
            <div><dt>경험치</dt><dd>{formatNumber(enemy.xpReward)}</dd></div>
          </dl>
        </div>
      </div>

      <dl className="tactical-intel-panel__drops" aria-label="확정 전리품">
        {CAMP_MATERIAL_IDS.filter((id) => drops[id] > 0).map((id) => (
          <div key={id}>
            <dt>{MATERIAL_LABELS[id]}</dt>
            <dd>+{drops[id]}</dd>
          </div>
        ))}
      </dl>

      {milestoneReward !== null && (
        <p className="tactical-intel-panel__milestone" data-status={milestoneStatus}>
          <strong>최초 승리 보상</strong>
          <span>
            {milestoneClaimed
              ? '지급 완료'
              : `골드 +${formatNumber(milestoneReward.configuredGold)} 지급 가능`}
          </span>
        </p>
      )}
    </section>
  )
}

function CharacterIntel({ state }: { state: GameState }) {
  const hero = getHeroStats(state)
  const companionId = state.player.companion.id
  const companion = companionId === null ? null : COMPANION_DEFINITIONS[companionId]
  const companionCooldownSeconds = Math.ceil(state.battle.companionCooldownMs / 1_000)

  return (
    <div className="tactical-intel-panel__section-stack">
      <article className="tactical-intel-card tactical-intel-card--character">
        <GameAsset
          assetId="hero.ashen-knight.default"
          purpose="character"
          decorative
          fallbackLabel="A"
          className="tactical-intel-card__portrait"
          fit="cover"
        />
        <div className="tactical-intel-card__body">
          <p className="eyebrow">WANDERING KNIGHT</p>
          <h3>아렌 · Lv.{state.player.level}</h3>
          <StatBar
            label="영웅 체력"
            value={state.player.currentHp}
            maximum={hero.maxHp}
            tone="health"
          />
          <StatBar
            label="경험치"
            value={state.player.xp}
            maximum={getXpToNextLevel(state.player.level)}
            tone="xp"
          />
        </div>
      </article>

      <dl className="tactical-intel-panel__stat-grid tactical-intel-panel__stat-grid--hero">
        <div><dt>공격력</dt><dd>{formatNumber(hero.attack)}</dd></div>
        <div><dt>방어력</dt><dd>{formatNumber(hero.defense)}</dd></div>
        <div><dt>골드 배율</dt><dd>×{Number(hero.goldMultiplier.toFixed(2))}</dd></div>
        <div><dt>스킬 포인트</dt><dd>{formatNumber(state.player.skillPoints)}</dd></div>
      </dl>

      <article className="tactical-intel-card tactical-intel-card--companion">
        {companion === null ? (
          <div className="tactical-intel-card__empty">
            <FontAwesomeIcon icon={faUserShield} aria-hidden="true" />
            <div>
              <h3>동료 미영입</h3>
              <p>스테이지 11을 열면 불씨 여우 루미를 영입할 수 있습니다.</p>
            </div>
          </div>
        ) : (
          <>
            <GameAsset
              assetId={companion.assetId}
              purpose="character"
              decorative
              fallbackLabel="L"
              className="tactical-intel-card__companion-art"
              fit="cover"
            />
            <div className="tactical-intel-card__body">
              <p className="eyebrow">COMPANION</p>
              <h3>{companion.name} · Rank {state.player.companion.rank}</h3>
              <p>{companion.description}</p>
              <dl className="tactical-intel-panel__inline-stats">
                <div><dt>협공 피해</dt><dd>{formatNumber(getCompanionDamage(state))}</dd></div>
                <div>
                  <dt>다음 협공</dt>
                  <dd>{companionCooldownSeconds === 0 ? '준비됨' : `${companionCooldownSeconds}초`}</dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </article>
    </div>
  )
}

function InventoryIntel({
  state,
  disabled,
  disabledReason,
  disabledReasonId,
  onEquipQuickConsumable,
}: {
  state: GameState
  disabled: boolean
  disabledReason?: string
  disabledReasonId: string
  onEquipQuickConsumable: (id: CampQuickConsumableId | null) => void
}) {
  const healingPotionEquipped = state.camp.quickConsumable === 'healingPotion'
  const healingPotionCount = state.camp.consumables.healingPotion
  const healingRecovery = getHealingPotionRecoveryAmount(state)

  return (
    <div className="tactical-intel-panel__section-stack">
      {disabled && (
        <p id={disabledReasonId} className="tactical-intel-panel__disabled-reason" role="status">
          {disabledReason ?? '현재는 빠른 슬롯 장착을 변경할 수 없습니다.'}
        </p>
      )}

      <section aria-labelledby="tactical-intel-equipped-title">
        <header className="tactical-intel-panel__subheading">
          <p className="eyebrow">EQUIPPED</p>
          <h3 id="tactical-intel-equipped-title">착용 장비</h3>
        </header>
        <div className="tactical-intel-panel__equipment-grid">
          {UPGRADE_IDS.map((id) => {
            const definition = UPGRADE_DEFINITIONS[id]
            return (
              <article key={id}>
                <GameAsset
                  assetId={definition.assetId}
                  purpose="card"
                  decorative
                  fallbackLabel="◆"
                  className="tactical-intel-panel__item-art"
                  fit="cover"
                />
                <div>
                  <strong>{definition.name}</strong>
                  <span>Lv.{state.player.upgrades[id]} · 착용 중</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="tactical-intel-material-title">
        <header className="tactical-intel-panel__subheading">
          <p className="eyebrow">MATERIALS</p>
          <h3 id="tactical-intel-material-title">제작 재료</h3>
        </header>
        <dl className="tactical-intel-panel__inventory-counts">
          {CAMP_MATERIAL_IDS.map((id) => (
            <div key={id}>
              <dt>{MATERIAL_LABELS[id]}</dt>
              <dd>{formatNumber(state.camp.materials[id])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tactical-intel-consumable-title">
        <header className="tactical-intel-panel__subheading">
          <p className="eyebrow">CONSUMABLES</p>
          <h3 id="tactical-intel-consumable-title">전투 보급품</h3>
        </header>
        <div className="tactical-intel-panel__consumables">
          {CAMP_CONSUMABLE_IDS.map((id) => {
            const detail = CONSUMABLE_DETAILS[id]
            const isHealingPotion = id === 'healingPotion'
            return (
              <article key={id} data-consumable-id={id}>
                <span className="tactical-intel-panel__consumable-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={detail.icon} fixedWidth />
                </span>
                <div>
                  <h4>{detail.name} ×{formatNumber(state.camp.consumables[id])}</h4>
                  <p>{detail.description}</p>
                  <small>{getConsumableStatus(state, id)}</small>
                </div>
                {isHealingPotion && (
                  <button
                    type="button"
                    aria-pressed={healingPotionEquipped}
                    aria-describedby={disabled ? disabledReasonId : undefined}
                    disabled={disabled || (!healingPotionEquipped && healingPotionCount < 1)}
                    onClick={() => onEquipQuickConsumable(
                      healingPotionEquipped ? null : 'healingPotion',
                    )}
                  >
                    {healingPotionEquipped ? '장착 해제' : '빠른 슬롯 장착'}
                    <small>HP +{formatNumber(healingRecovery)}</small>
                  </button>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="tactical-intel-buff-title">
        <header className="tactical-intel-panel__subheading">
          <p className="eyebrow">ACTIVE EFFECTS</p>
          <h3 id="tactical-intel-buff-title">활성 버프</h3>
        </header>
        <dl className="tactical-intel-panel__inventory-counts">
          <div>
            <dt>골드 획득</dt>
            <dd>{state.camp.buffs.goldBoostRounds > 0
              ? `+50% · ${formatNumber(state.camp.buffs.goldBoostRounds)}R`
              : '비활성'}</dd>
          </div>
          <div>
            <dt>보스 집중</dt>
            <dd>{state.camp.buffs.bossFocusStage === null
              ? '비활성'
              : state.camp.buffs.bossFocusStage === 0
                ? '다음 보스'
                : `STAGE ${state.camp.buffs.bossFocusStage}`}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

function SkillIntel({ state }: { state: GameState }) {
  return (
    <div className="tactical-intel-panel__skill-list">
      {SKILL_IDS.map((id) => {
        const definition = SKILL_DEFINITIONS[id]
        const rank = state.player.skills[id]
        const unlocked = isSkillUnlocked(state, id)
        const cooldownSeconds = id === 'powerStrike'
          ? Math.ceil(state.battle.powerStrikeCooldownMs / 1_000)
          : null
        return (
          <article key={id} data-skill-id={id} data-unlocked={unlocked}>
            <GameAsset
              assetId={definition.assetId}
              purpose="card"
              decorative
              fallbackLabel="◆"
              className="tactical-intel-panel__skill-art"
              fit="cover"
            />
            <div>
              <span>{unlocked ? `Rank ${rank}` : `Lv.${definition.unlockLevel} 해금`}</span>
              <h3>{definition.name}</h3>
              <p>{definition.description}</p>
              {cooldownSeconds !== null && (
                <small>{rank === 0
                  ? '미각인'
                  : cooldownSeconds === 0
                    ? '자동 시전 준비됨'
                    : `자동 시전 ${cooldownSeconds}초`}</small>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function BestiaryIntel({ state }: { state: GameState }) {
  return (
    <div className="tactical-intel-panel__bestiary" aria-label="적 도감 목록">
      {BESTIARY_FIRST_STAGES.map((firstStage) => {
        const enemy = getEnemyDefinition(firstStage)
        const discovered = state.battle.highestStage >= firstStage
        return (
          <article
            key={enemy.assetId}
            data-bestiary-id={enemy.assetId}
            data-discovered={discovered}
            aria-label={discovered
              ? `${enemy.name}, 최초 등장 스테이지 ${firstStage}`
              : `미발견 적, 스테이지 ${firstStage}에서 발견 가능`}
          >
            {discovered ? (
              <GameAsset
                assetId={enemy.assetId}
                purpose="character"
                decorative
                fallbackLabel={enemy.isBoss ? 'B' : 'E'}
                className="tactical-intel-panel__bestiary-art"
                fit="cover"
              />
            ) : (
              <span className="tactical-intel-panel__bestiary-locked" aria-hidden="true">
                <FontAwesomeIcon icon={faLock} fixedWidth />
              </span>
            )}
            <div>
              <span>{enemy.isBoss ? 'BOSS' : 'ENEMY'} · STAGE {firstStage}</span>
              <h3>{discovered ? enemy.name : '미발견'}</h3>
              <p>{discovered
                ? `공격력 ${formatNumber(enemy.attack)} · 기본 보상 ${formatNumber(enemy.goldReward)} G`
                : '원정을 진행하면 정보가 해금됩니다.'}</p>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function TacticalIntelPanel({
  state,
  onChooseStage,
  onEquipQuickConsumable,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  disabled = false,
  disabledReason,
}: TacticalIntelPanelProps) {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] =
    useState<TacticalIntelTabId>('map')
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab
  const tabRefs = useRef(new Map<TacticalIntelTabId, HTMLButtonElement>())
  const previousActiveTab = useRef(activeTab)
  const idPrefix = useId().replaceAll(':', '')
  const disabledReasonId = `${idPrefix}-intel-disabled-reason`

  useEffect(() => {
    if (previousActiveTab.current === activeTab) return
    previousActiveTab.current = activeTab
    const activeTabTrigger = tabRefs.current.get(activeTab)
    activeTabTrigger?.focus({ preventScroll: true })
    activeTabTrigger?.scrollIntoView?.({
      behavior: 'instant',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [activeTab])

  const activateTab = (id: TacticalIntelTabId) => {
    if (controlledActiveTab === undefined) setUncontrolledActiveTab(id)
    onActiveTabChange?.(id)
  }

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: TacticalIntelTabId,
  ) => {
    const currentIndex = INTEL_TABS.findIndex(({ id }) => id === tabId)
    let nextIndex: number

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + INTEL_TABS.length) % INTEL_TABS.length
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % INTEL_TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = INTEL_TABS.length - 1
    } else {
      return
    }

    event.preventDefault()
    const nextTab = INTEL_TABS[nextIndex]
    if (nextTab === undefined) return
    activateTab(nextTab.id)
    tabRefs.current.get(nextTab.id)?.focus()
  }

  const activeDefinition = INTEL_TABS.find(({ id }) => id === activeTab)!
  const activeTabId = `${idPrefix}-intel-tab-${activeTab}`
  const activePanelId = `${idPrefix}-intel-panel-${activeTab}`

  return (
    <section className="tactical-intel-panel" aria-labelledby={`${idPrefix}-intel-title`}>
      <header className="tactical-intel-panel__header">
        <div>
          <p className="eyebrow">TACTICAL INTELLIGENCE</p>
          <h2 id={`${idPrefix}-intel-title`}>전술 정보실</h2>
        </div>
      </header>

      <EnemySummary state={state} />

      <div className="tactical-intel-panel__tablist" role="tablist" aria-label="전술 정보 메뉴">
        {INTEL_TABS.map((tab) => {
          const selected = tab.id === activeTab
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node === null) tabRefs.current.delete(tab.id)
                else tabRefs.current.set(tab.id, node)
              }}
              id={`${idPrefix}-intel-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={selected ? `${idPrefix}-intel-panel-${tab.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => activateTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
            >
              <FontAwesomeIcon icon={tab.icon} fixedWidth aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      <div
        id={activePanelId}
        className="tactical-intel-panel__tabpanel"
        role="tabpanel"
        aria-labelledby={activeTabId}
        data-intel-panel={activeTab}
      >
        <header className="sr-only">
          <h3>{activeDefinition.label}</h3>
        </header>
        {activeTab === 'map' && (
          <StageMapPanel
            currentStage={state.battle.stage}
            highestStage={state.battle.highestStage}
            onChooseStage={onChooseStage}
            disabled={disabled}
            {...(disabledReason === undefined ? {} : { disabledReason })}
          />
        )}
        {activeTab === 'character' && <CharacterIntel state={state} />}
        {activeTab === 'inventory' && (
          <InventoryIntel
            state={state}
            disabled={disabled}
            disabledReasonId={disabledReasonId}
            onEquipQuickConsumable={onEquipQuickConsumable}
            {...(disabledReason === undefined ? {} : { disabledReason })}
          />
        )}
        {activeTab === 'skills' && <SkillIntel state={state} />}
        {activeTab === 'bestiary' && <BestiaryIntel state={state} />}
      </div>
    </section>
  )
}
