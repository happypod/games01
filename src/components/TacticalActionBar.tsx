import { faBowlFood, faFlask } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { SKILL_DEFINITIONS, UPGRADE_DEFINITIONS } from '../game/content'
import {
  getSkillEffectComparison,
  getSkillPointCost,
  getUpgradeCost,
  getUpgradeEffectComparison,
  isSkillUnlocked,
  type GrowthEffectComparison,
  type GrowthEffectMetricKey,
} from '../game/formulas'
import { formatNumber } from '../game/format'
import {
  SKILL_IDS,
  UPGRADE_IDS,
  type CampConsumableId,
  type GameState,
  type SkillId,
  type UpgradeId,
} from '../game/types'
import { GameAsset } from './GameAsset'

const CONSUMABLE_IDS = ['goldStew', 'focusTonic'] as const satisfies readonly CampConsumableId[]

const TACTICAL_ACTION_SLOT_IDS = [
  ...UPGRADE_IDS,
  ...SKILL_IDS,
  ...CONSUMABLE_IDS,
] as const

type TacticalActionSlotId = (typeof TACTICAL_ACTION_SLOT_IDS)[number]

type ActionStatus =
  | 'available'
  | 'locked'
  | 'insufficient'
  | 'max'
  | 'globally-disabled'

interface TacticalActionBarProps {
  state: GameState
  onBuyUpgrade: (id: UpgradeId) => void
  onBuySkill: (id: SkillId) => void
  onEnterCamp: () => void
  disabled?: boolean
  disabledReason?: string
}

interface ProgressionDetail {
  kind: 'equipment' | 'skill'
  name: string
  description: string
  rankLabel: string
  modeLabel: string | null
  comparison: GrowthEffectComparison
  costLabel: string | null
  status: ActionStatus
  statusText: string
  actionLabel: string
  onAction: () => void
}

const EFFECT_LABELS: Record<GrowthEffectMetricKey, string> = {
  attack: '공격력',
  maxHp: '최대 체력',
  defense: '방어력',
  goldBonusPercent: '골드 보너스',
  powerStrikeMultiplier: '피해 배율',
}

const CONSUMABLE_COPY: Record<CampConsumableId, {
  name: string
  description: string
  activeCopy: (state: GameState) => string
}> = {
  goldStew: {
    name: '황금 스튜',
    description: '다음 1,800 전투 라운드의 골드 획득량을 50% 높입니다.',
    activeCopy: (state) => state.camp.buffs.goldBoostRounds > 0
      ? `현재 효과가 ${formatNumber(state.camp.buffs.goldBoostRounds)}라운드 남았습니다.`
      : '현재 준비된 골드 보너스가 없습니다.',
  },
  focusTonic: {
    name: '집중 물약',
    description: '다음 보스전의 치명타 확률을 35%로 준비합니다.',
    activeCopy: (state) => state.camp.buffs.bossFocusStage === null
      ? '현재 준비된 보스 집중 효과가 없습니다.'
      : state.camp.buffs.bossFocusStage === 0
        ? '다음 보스전을 위한 집중 효과가 준비되어 있습니다.'
        : `스테이지 ${state.camp.buffs.bossFocusStage} 보스에 집중 효과가 적용 중입니다.`,
  },
}

function isUpgradeId(id: TacticalActionSlotId): id is UpgradeId {
  return UPGRADE_IDS.some((candidate) => candidate === id)
}

function isSkillId(id: TacticalActionSlotId): id is SkillId {
  return SKILL_IDS.some((candidate) => candidate === id)
}

function formatEffectValue(key: GrowthEffectMetricKey, value: number | null): string {
  if (value === null) return '비활성'
  if (key === 'goldBonusPercent') return `+${formatNumber(value)}%`
  if (key === 'powerStrikeMultiplier') return `×${Number(value.toFixed(2))}`
  return formatNumber(value)
}

function getUpgradeDetail(
  state: GameState,
  id: UpgradeId,
  disabled: boolean,
  disabledReason: string | undefined,
  onBuyUpgrade: (id: UpgradeId) => void,
): ProgressionDetail {
  const definition = UPGRADE_DEFINITIONS[id]
  const level = state.player.upgrades[id]
  const comparison = getUpgradeEffectComparison(state, id)
  const cost = getUpgradeCost(id, level)
  const shortage = Math.max(0, cost - state.player.gold)
  const status: ActionStatus = comparison.isMax
    ? 'max'
    : disabled
      ? 'globally-disabled'
      : shortage > 0
        ? 'insufficient'
        : 'available'

  return {
    kind: 'equipment',
    name: definition.name,
    description: definition.description,
    rankLabel: `Lv.${level}`,
    modeLabel: null,
    comparison,
    costLabel: comparison.isMax ? null : `${formatNumber(cost)} G`,
    status,
    statusText: status === 'max'
      ? '최대 강화에 도달했습니다.'
      : status === 'globally-disabled'
        ? (disabledReason ?? '지금은 강화할 수 없습니다.')
        : status === 'insufficient'
          ? `골드가 ${formatNumber(shortage)} 부족합니다.`
          : '지금 강화할 수 있습니다.',
    actionLabel: status === 'max' ? 'MAX' : `${definition.name} 강화`,
    onAction: () => onBuyUpgrade(id),
  }
}

function getSkillModeLabel(state: GameState, id: SkillId): string {
  if (id !== 'powerStrike') return 'PASSIVE'
  if (state.player.skills.powerStrike === 0) return 'AUTO · 미각인'
  const remainingSeconds = Math.ceil(state.battle.powerStrikeCooldownMs / 1_000)
  return remainingSeconds > 0 ? `AUTO · ${remainingSeconds}초` : 'AUTO · 준비'
}

function getSkillDetail(
  state: GameState,
  id: SkillId,
  disabled: boolean,
  disabledReason: string | undefined,
  onBuySkill: (id: SkillId) => void,
): ProgressionDetail {
  const definition = SKILL_DEFINITIONS[id]
  const rank = state.player.skills[id]
  const comparison = getSkillEffectComparison(state, id)
  const cost = getSkillPointCost(id, rank)
  const unlocked = isSkillUnlocked(state, id)
  const shortage = Math.max(0, cost - state.player.skillPoints)
  const status: ActionStatus = !unlocked
    ? 'locked'
    : comparison.isMax
      ? 'max'
      : disabled
        ? 'globally-disabled'
        : shortage > 0
          ? 'insufficient'
          : 'available'

  return {
    kind: 'skill',
    name: definition.name,
    description: definition.description,
    rankLabel: `Rank ${rank}`,
    modeLabel: getSkillModeLabel(state, id),
    comparison,
    costLabel: comparison.isMax ? null : `${cost} SP`,
    status,
    statusText: status === 'locked'
      ? `영웅 레벨 ${definition.unlockLevel}에 해금됩니다.`
      : status === 'max'
        ? '최대 랭크에 도달했습니다.'
        : status === 'globally-disabled'
          ? (disabledReason ?? '지금은 각인할 수 없습니다.')
          : status === 'insufficient'
            ? `스킬 포인트가 ${shortage} 부족합니다.`
            : '지금 각인할 수 있습니다.',
    actionLabel: status === 'max' ? 'MAX' : status === 'locked' ? '잠김' : `${definition.name} 각인`,
    onAction: () => onBuySkill(id),
  }
}

export function TacticalActionBar({
  state,
  onBuyUpgrade,
  onBuySkill,
  onEnterCamp,
  disabled = false,
  disabledReason,
}: TacticalActionBarProps) {
  const [selectedSlot, setSelectedSlot] = useState<TacticalActionSlotId | null>(null)
  const [tabStopSlot, setTabStopSlot] = useState<TacticalActionSlotId>(
    TACTICAL_ACTION_SLOT_IDS[0],
  )
  const barRef = useRef<HTMLElement>(null)
  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const triggerRefs = useRef(new Map<TacticalActionSlotId, HTMLButtonElement>())
  const detailId = `${useId().replaceAll(':', '')}-tactical-action-detail`

  useLayoutEffect(() => {
    if (selectedSlot !== null) detailHeadingRef.current?.focus()
  }, [selectedSlot])

  useEffect(() => {
    if (selectedSlot === null) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && barRef.current?.contains(target)) return
      setSelectedSlot(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return
      const target = event.target
      if (
        target instanceof Element
        && target.closest('[role="dialog"][aria-modal="true"]') !== null
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const trigger = triggerRefs.current.get(selectedSlot)
      setSelectedSlot(null)
      trigger?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedSlot])

  const progressionDetail = selectedSlot !== null && isUpgradeId(selectedSlot)
    ? getUpgradeDetail(state, selectedSlot, disabled, disabledReason, onBuyUpgrade)
    : selectedSlot !== null && isSkillId(selectedSlot)
      ? getSkillDetail(state, selectedSlot, disabled, disabledReason, onBuySkill)
      : null
  const selectedConsumable = selectedSlot !== null && !isUpgradeId(selectedSlot) && !isSkillId(selectedSlot)
    ? selectedSlot
    : null

  const handleSlotKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    id: TacticalActionSlotId,
  ) => {
    const currentIndex = TACTICAL_ACTION_SLOT_IDS.indexOf(id)
    let nextIndex: number

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + TACTICAL_ACTION_SLOT_IDS.length)
          % TACTICAL_ACTION_SLOT_IDS.length
        break
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % TACTICAL_ACTION_SLOT_IDS.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = TACTICAL_ACTION_SLOT_IDS.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    const nextSlot = TACTICAL_ACTION_SLOT_IDS[nextIndex]
    if (nextSlot === undefined) return
    setTabStopSlot(nextSlot)
    triggerRefs.current.get(nextSlot)?.focus()
  }

  return (
    <section ref={barRef} className="tactical-action-bar" aria-label="장비와 스킬 빠른 슬롯">
      <div className="tactical-action-bar__slots" role="toolbar" aria-label="전술 슬롯바">
        {TACTICAL_ACTION_SLOT_IDS.map((id) => {
          const selected = selectedSlot === id
          const kind = isUpgradeId(id) ? 'equipment' : isSkillId(id) ? 'skill' : 'consumable'
          const name = isUpgradeId(id)
            ? UPGRADE_DEFINITIONS[id].name
            : isSkillId(id)
              ? SKILL_DEFINITIONS[id].name
              : CONSUMABLE_COPY[id].name
          const meta = isUpgradeId(id)
            ? `Lv.${state.player.upgrades[id]}`
            : isSkillId(id)
              ? getSkillModeLabel(state, id)
              : `보유 ${formatNumber(state.camp.consumables[id])}`

          return (
            <button
              key={id}
              ref={(node) => {
                if (node === null) triggerRefs.current.delete(id)
                else triggerRefs.current.set(id, node)
              }}
              type="button"
              tabIndex={tabStopSlot === id ? 0 : -1}
              className={`tactical-action-bar__slot tactical-action-bar__slot--${kind}`}
              data-action-slot={id}
              data-action-kind={kind}
              aria-expanded={selected}
              aria-controls={selected ? detailId : undefined}
              aria-label={`${name}, ${meta}, 상세 ${selected ? '닫기' : '열기'}`}
              onFocus={() => setTabStopSlot(id)}
              onKeyDown={(event) => handleSlotKeyDown(event, id)}
              onClick={() => {
                setTabStopSlot(id)
                setSelectedSlot((current) => current === id ? null : id)
              }}
            >
              <span className="tactical-action-bar__slot-visual" aria-hidden="true">
                {isUpgradeId(id) || isSkillId(id) ? (
                  <GameAsset
                    assetId={isUpgradeId(id)
                      ? UPGRADE_DEFINITIONS[id].assetId
                      : SKILL_DEFINITIONS[id].assetId}
                    purpose="card"
                    decorative
                    className="tactical-action-bar__slot-asset"
                    fit="cover"
                    loading="eager"
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={id === 'goldStew' ? faBowlFood : faFlask}
                    className="tactical-action-bar__slot-icon"
                  />
                )}
              </span>
              <span className="tactical-action-bar__slot-copy">
                <strong className="tactical-action-bar__slot-name">{name}</strong>
                <small className="tactical-action-bar__slot-meta">{meta}</small>
              </span>
            </button>
          )
        })}
      </div>

      {progressionDetail !== null && selectedSlot !== null && (
        <section
          id={detailId}
          className="tactical-action-bar__detail"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${detailId}-title`}
          data-action-detail={selectedSlot}
          data-action-status={progressionDetail.status}
        >
          <header className="tactical-action-bar__detail-header">
            <div>
              <p className="tactical-action-bar__detail-kicker">
                {progressionDetail.kind === 'equipment' ? '장비' : progressionDetail.modeLabel}
              </p>
              <h3 ref={detailHeadingRef} id={`${detailId}-title`} tabIndex={-1}>
                {progressionDetail.name}
              </h3>
              <span>{progressionDetail.rankLabel}</span>
            </div>
            <button
              type="button"
              className="tactical-action-bar__detail-close"
              onClick={() => {
                const trigger = triggerRefs.current.get(selectedSlot)
                setSelectedSlot(null)
                trigger?.focus()
              }}
              aria-label={`${progressionDetail.name} 상세 닫기`}
            >
              닫기
            </button>
          </header>
          <p className="tactical-action-bar__detail-description">{progressionDetail.description}</p>
          <dl className="tactical-action-bar__detail-effects">
            {progressionDetail.comparison.metrics.map((metric) => (
              <div key={metric.key} className="tactical-action-bar__detail-effect">
                <dt>{EFFECT_LABELS[metric.key]}</dt>
                <dd>
                  <span>현재 {formatEffectValue(metric.key, metric.current)}</span>
                  {metric.next !== null && <span>다음 {formatEffectValue(metric.key, metric.next)}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="tactical-action-bar__detail-status" role="status">
            {progressionDetail.statusText}
          </p>
          <button
            type="button"
            className="tactical-action-bar__detail-action"
            disabled={progressionDetail.status !== 'available'}
            onClick={progressionDetail.onAction}
          >
            <span>{progressionDetail.actionLabel}</span>
            {progressionDetail.costLabel !== null && <small>{progressionDetail.costLabel}</small>}
          </button>
        </section>
      )}

      {selectedConsumable !== null && (
        <section
          id={detailId}
          className="tactical-action-bar__detail tactical-action-bar__detail--consumable"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${detailId}-title`}
          data-action-detail={selectedConsumable}
          data-action-status={disabled ? 'globally-disabled' : 'available'}
        >
          <header className="tactical-action-bar__detail-header">
            <div>
              <p className="tactical-action-bar__detail-kicker">전투 보급품</p>
              <h3 ref={detailHeadingRef} id={`${detailId}-title`} tabIndex={-1}>
                {CONSUMABLE_COPY[selectedConsumable].name}
              </h3>
              <span>보유 {formatNumber(state.camp.consumables[selectedConsumable])}</span>
            </div>
            <button
              type="button"
              className="tactical-action-bar__detail-close"
              onClick={() => {
                const trigger = triggerRefs.current.get(selectedConsumable)
                setSelectedSlot(null)
                trigger?.focus()
              }}
              aria-label={`${CONSUMABLE_COPY[selectedConsumable].name} 상세 닫기`}
            >
              닫기
            </button>
          </header>
          <p className="tactical-action-bar__detail-description">
            {CONSUMABLE_COPY[selectedConsumable].description}
          </p>
          <p className="tactical-action-bar__detail-status" role="status">
            {disabled
              ? (disabledReason ?? '지금은 캠프로 이동할 수 없습니다.')
              : CONSUMABLE_COPY[selectedConsumable].activeCopy(state)}
          </p>
          <button
            type="button"
            className="tactical-action-bar__detail-action"
            disabled={disabled}
            onClick={onEnterCamp}
          >
            캠프에서 준비
          </button>
        </section>
      )}
    </section>
  )
}
