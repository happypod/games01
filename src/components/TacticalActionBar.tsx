import { faFlask } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { getHealingPotionRecoveryAmount } from '../game/camp'
import {
  COMPANION_DEFINITIONS,
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
} from '../game/content'
import { getItemDefinition } from '../game/itemRegistry'
import {
  getCompanionDamage,
  getCompanionTrainingCost,
  getHeroStats,
  getSkillEffectComparison,
  getSkillPointCost,
  getUpgradeCost,
  getUpgradeEffectComparison,
  isCompanionUnlocked,
  isSkillUnlocked,
  type GrowthEffectComparison,
  type GrowthEffectMetricKey,
} from '../game/formulas'
import { formatNumber } from '../game/format'
import {
  COMPANION_IDS,
  SKILL_IDS,
  UPGRADE_IDS,
  type CompanionId,
  type EquipmentSlot,
  type GameState,
  type SkillId,
  type UpgradeId,
} from '../game/types'
import { GameAsset } from './GameAsset'

const COMPANION_SLOT_ID = 'companion' as const
const QUICK_CONSUMABLE_SLOT_ID = 'quickConsumable' as const
const TACTICAL_ACTION_SLOT_IDS = [
  ...UPGRADE_IDS,
  ...SKILL_IDS,
  COMPANION_SLOT_ID,
  QUICK_CONSUMABLE_SLOT_ID,
] as const

type TacticalActionSlotId = (typeof TACTICAL_ACTION_SLOT_IDS)[number]

type ActionStatus =
  | 'available'
  | 'locked'
  | 'insufficient'
  | 'max'
  | 'globally-disabled'

type QuickConsumableStatus =
  | 'available'
  | 'unmounted'
  | 'empty'
  | 'full'
  | 'globally-disabled'

interface TacticalActionBarProps {
  state: GameState
  onBuyUpgrade: (id: UpgradeId) => void
  onBuySkill: (id: SkillId) => void
  onRecruitCompanion: (id: CompanionId) => void
  onTrainCompanion: () => void
  onUseEquippedConsumable: () => void
  onOpenInventory: () => void
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

  const slotByUpgradeId: Record<UpgradeId, EquipmentSlot> = {
    weapon: 'weapon',
    armor: 'armor',
    charm: 'accessory',
  }
  const slot = slotByUpgradeId[id]
  const equippedId = state.player.equipped[slot]
  const equippedItem = equippedId ? getItemDefinition(equippedId) : null

  return {
    kind: 'equipment',
    name: definition.name,
    description: equippedItem ? `[${equippedItem.name} 착용 중] ${equippedItem.description}` : `${definition.description} (현재 슬롯 미장착)`,
    rankLabel: equippedItem ? `${equippedItem.name} Lv.${level}` : `Lv.${level}`,
    modeLabel: equippedItem ? '착용 중' : '미장착',
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
    actionLabel: status === 'max'
      ? 'MAX'
      : status === 'locked'
        ? '잠김'
        : `${definition.name} 각인`,
    onAction: () => onBuySkill(id),
  }
}

export function TacticalActionBar({
  state,
  onBuyUpgrade,
  onBuySkill,
  onRecruitCompanion,
  onTrainCompanion,
  onUseEquippedConsumable,
  onOpenInventory,
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

  const companionId = COMPANION_IDS[0]
  const companionDefinition = COMPANION_DEFINITIONS[companionId]
  const companionRecruited = state.player.companion.id === companionId
  const companionRank = companionRecruited ? state.player.companion.rank : 0
  const companionUnlocked = isCompanionUnlocked(state, companionId)
  const companionMax = companionRecruited
    && companionRank >= companionDefinition.maxRank
  const companionCost = companionRecruited
    ? getCompanionTrainingCost(companionId, companionRank)
    : 0
  const companionShortage = companionRecruited
    ? Math.max(0, companionCost - state.player.gold)
    : 0
  const companionStatus: ActionStatus = !companionRecruited && !companionUnlocked
    ? 'locked'
    : companionMax
      ? 'max'
      : disabled
        ? 'globally-disabled'
        : companionShortage > 0
          ? 'insufficient'
          : 'available'
  const companionStatusText = companionStatus === 'locked'
    ? `첫 보스를 격파하고 스테이지 ${companionDefinition.unlockStage}을 열면 영입할 수 있습니다.`
    : companionStatus === 'max'
      ? '최대 랭크입니다.'
      : companionStatus === 'globally-disabled'
        ? (disabledReason ?? '지금은 동료를 변경할 수 없습니다.')
        : companionStatus === 'insufficient'
          ? `골드가 ${formatNumber(companionShortage)} 부족합니다.`
          : companionRecruited
            ? '지금 훈련할 수 있습니다.'
            : '첫 보스 승리 보상으로 무료 영입할 수 있습니다.'

  const hero = getHeroStats(state)
  const quickEquipped = state.camp.quickConsumable === 'healingPotion'
  const quickCount = state.camp.consumables.healingPotion
  const quickRecovery = getHealingPotionRecoveryAmount(state)
  const quickStatus: QuickConsumableStatus = disabled
    ? 'globally-disabled'
    : !quickEquipped
      ? 'unmounted'
      : quickCount < 1
        ? 'empty'
        : state.player.currentHp >= hero.maxHp
          ? 'full'
          : 'available'
  const quickStatusText = quickStatus === 'globally-disabled'
    ? (disabledReason ?? '지금은 빠른 소모품을 사용할 수 없습니다.')
    : quickStatus === 'unmounted'
      ? '빠른 슬롯에 장착된 회복 물약이 없습니다.'
      : quickStatus === 'empty'
        ? '장착은 유지되지만 보유한 회복 물약이 없습니다.'
        : quickStatus === 'full'
          ? '현재 체력이 가득 차 있습니다.'
          : `사용하면 최대 체력의 35%인 ${formatNumber(quickRecovery)} HP를 회복합니다.`

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

  const closeDetail = () => {
    if (selectedSlot === null) return
    const trigger = triggerRefs.current.get(selectedSlot)
    setSelectedSlot(null)
    trigger?.focus()
  }

  return (
    <section ref={barRef} className="tactical-action-bar" aria-label="전술 명령 빠른 슬롯">
      <div className="tactical-action-bar__slots" role="toolbar" aria-label="전술 슬롯바">
        {TACTICAL_ACTION_SLOT_IDS.map((id) => {
          const selected = selectedSlot === id
          const kind = isUpgradeId(id)
            ? 'equipment'
            : isSkillId(id)
              ? 'skill'
              : id === COMPANION_SLOT_ID
                ? 'companion'
                : 'consumable'
          const name = isUpgradeId(id)
            ? UPGRADE_DEFINITIONS[id].name
            : isSkillId(id)
              ? SKILL_DEFINITIONS[id].name
              : id === COMPANION_SLOT_ID
                ? companionDefinition.name
                : quickEquipped
                  ? '회복 물약'
                  : '빠른 소모품'
          const meta = isUpgradeId(id)
            ? `Lv.${state.player.upgrades[id]}`
            : isSkillId(id)
              ? getSkillModeLabel(state, id)
              : id === COMPANION_SLOT_ID
                ? companionRecruited
                  ? `Rank ${companionRank}`
                  : companionUnlocked
                    ? '영입 가능'
                    : '미영입'
                : quickEquipped
                  ? `보유 ${formatNumber(quickCount)}`
                  : '미장착'

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
                ) : id === COMPANION_SLOT_ID ? (
                  <GameAsset
                    assetId={companionDefinition.assetId}
                    purpose="character"
                    decorative
                    className="tactical-action-bar__slot-asset"
                    fit="cover"
                    loading="lazy"
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={faFlask}
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
              onClick={closeDetail}
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

      {selectedSlot === COMPANION_SLOT_ID && (
        <section
          id={detailId}
          className="tactical-action-bar__detail"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${detailId}-title`}
          data-action-detail={COMPANION_SLOT_ID}
          data-action-status={companionStatus}
        >
          <header className="tactical-action-bar__detail-header">
            <div>
              <p className="tactical-action-bar__detail-kicker">원정 협공</p>
              <h3 ref={detailHeadingRef} id={`${detailId}-title`} tabIndex={-1}>
                {companionDefinition.name}
              </h3>
              <span>{companionRecruited ? `Rank ${companionRank}` : '미영입'}</span>
            </div>
            <button
              type="button"
              className="tactical-action-bar__detail-close"
              onClick={closeDetail}
              aria-label={`${companionDefinition.name} 상세 닫기`}
            >
              닫기
            </button>
          </header>
          <p className="tactical-action-bar__detail-description">
            {companionDefinition.description}
          </p>
          {companionRecruited && (
            <dl className="tactical-action-bar__detail-effects">
              <div className="tactical-action-bar__detail-effect">
                <dt>협공 피해</dt>
                <dd><span>{formatNumber(getCompanionDamage(state))}</span></dd>
              </div>
              <div className="tactical-action-bar__detail-effect">
                <dt>다음 협공</dt>
                <dd>
                  <span>{state.battle.companionCooldownMs === 0
                    ? '준비됨'
                    : `${Math.ceil(state.battle.companionCooldownMs / 1_000)}초`}</span>
                </dd>
              </div>
            </dl>
          )}
          <p className="tactical-action-bar__detail-status" role="status">
            {companionStatusText}
          </p>
          <button
            type="button"
            className="tactical-action-bar__detail-action"
            disabled={companionStatus !== 'available'}
            onClick={() => companionRecruited
              ? onTrainCompanion()
              : onRecruitCompanion(companionId)}
          >
            <span>{companionRecruited ? (companionMax ? 'MAX' : '동료 훈련') : '무료 영입'}</span>
            {companionRecruited && !companionMax && (
              <small>{formatNumber(companionCost)} G</small>
            )}
          </button>
        </section>
      )}

      {selectedSlot === QUICK_CONSUMABLE_SLOT_ID && (
        <section
          id={detailId}
          className="tactical-action-bar__detail tactical-action-bar__detail--consumable"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${detailId}-title`}
          data-action-detail={QUICK_CONSUMABLE_SLOT_ID}
          data-action-status={quickStatus}
        >
          <header className="tactical-action-bar__detail-header">
            <div>
              <p className="tactical-action-bar__detail-kicker">전투 빠른 소모품</p>
              <h3 ref={detailHeadingRef} id={`${detailId}-title`} tabIndex={-1}>
                {quickEquipped ? '회복 물약' : '빠른 소모품'}
              </h3>
              <span>보유 {formatNumber(quickCount)}</span>
            </div>
            <button
              type="button"
              className="tactical-action-bar__detail-close"
              onClick={closeDetail}
              aria-label={`${quickEquipped ? '회복 물약' : '빠른 소모품'} 상세 닫기`}
            >
              닫기
            </button>
          </header>
          <p className="tactical-action-bar__detail-description">
            장착된 회복 물약은 전투 중 최대 체력의 35%인 {formatNumber(quickRecovery)} HP를 회복합니다.
          </p>
          <p className="tactical-action-bar__detail-status" role="status">
            {quickStatusText}
          </p>
          <button
            type="button"
            className="tactical-action-bar__detail-action"
            disabled={quickStatus !== 'available' && quickStatus !== 'unmounted'}
            onClick={() => {
              if (quickEquipped) {
                onUseEquippedConsumable()
                return
              }
              onOpenInventory()
              closeDetail()
            }}
          >
            {quickEquipped ? '회복 물약 사용' : '인벤토리 열기'}
          </button>
        </section>
      )}
    </section>
  )
}
