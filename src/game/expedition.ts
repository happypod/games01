import {
  EXPEDITION_DEFINITION_VERSION,
  EXPEDITION_EVENT_DEFINITIONS_V1,
  EXPEDITION_MILESTONE_COUNT,
  EXPEDITION_MILESTONE_INTERVAL,
  MAX_PENDING_EXPEDITION_EVENTS,
} from './content'
import { toSafeInteger } from './formulas'
import { createRngState, nextRandom, seedFromText } from './rng'
import {
  EXPEDITION_DEFINITION_IDS_V1,
  type ExpeditionDefinitionId,
  type ExpeditionEventState,
  type ExpeditionPendingEvent,
  type ExpeditionResolvedChoice,
} from './types'

export const MAX_EXPEDITION_MILESTONE_MASK = 2 ** EXPEDITION_MILESTONE_COUNT - 1
export const EXPEDITION_DEFINITION_SHUFFLE_ID = 'expedition-definitions-v1'

const isSafeNonNegativeInteger = (value: number) =>
  Number.isSafeInteger(value) && value >= 0

function hasMilestone(mask: number, milestoneIndex: number): boolean {
  const bit = 2 ** milestoneIndex
  return Math.floor(mask / bit) % 2 === 1
}

function claimMilestone(mask: number, milestoneIndex: number): number {
  return hasMilestone(mask, milestoneIndex) ? mask : mask + 2 ** milestoneIndex
}

function getVersionedDefinitionContract(definitionVersion: number) {
  switch (definitionVersion) {
    case 1:
      return {
        definitions: EXPEDITION_EVENT_DEFINITIONS_V1,
        definitionIds: EXPEDITION_DEFINITION_IDS_V1,
        shuffleId: EXPEDITION_DEFINITION_SHUFFLE_ID,
        eventIdPrefix: 'expedition-v1',
      } as const
    default:
      throw new RangeError('unsupported expedition definition version')
  }
}

export function isSupportedExpeditionDefinitionVersion(
  definitionVersion: number,
): boolean {
  try {
    getVersionedDefinitionContract(definitionVersion)
    return true
  } catch {
    return false
  }
}

function getDefinitionBag(
  savedSeed: number,
  runPrestige: number,
  blockIndex: number,
  definitionVersion: number,
): ExpeditionDefinitionId[] {
  const contract = getVersionedDefinitionContract(definitionVersion)
  const substreamSeed = seedFromText(
    `${savedSeed >>> 0}:${runPrestige}:${blockIndex}:${contract.shuffleId}`,
  )
  let substream = createRngState(substreamSeed)
  const bag = [...contract.definitionIds]

  for (let index = bag.length - 1; index > 0; index -= 1) {
    const draw = nextRandom(substream)
    substream = draw.rng
    const swapIndex = Math.floor(draw.value * (index + 1))
    const selected = bag[swapIndex]
    bag[swapIndex] = bag[index] as ExpeditionDefinitionId
    bag[index] = selected as ExpeditionDefinitionId
  }

  return bag
}

export function createInitialExpeditionEventState(
  runPrestige = 0,
): ExpeditionEventState {
  return {
    definitionVersion: EXPEDITION_DEFINITION_VERSION,
    runPrestige,
    milestoneMask: 0,
    pending: [],
    overflowCount: 0,
  }
}

export function deriveLegacyExpeditionMilestoneMask(highestStage: number): number {
  const normalizedStage = Number.isFinite(highestStage)
    ? Math.min(
        EXPEDITION_MILESTONE_COUNT * EXPEDITION_MILESTONE_INTERVAL,
        Math.max(0, Math.floor(highestStage)),
      )
    : 0
  const milestoneCount = Math.floor(normalizedStage / EXPEDITION_MILESTONE_INTERVAL)
  return milestoneCount === 0 ? 0 : 2 ** milestoneCount - 1
}

export function getExpeditionDefinitionForMilestone(
  savedSeed: number,
  runPrestige: number,
  milestoneIndex: number,
  definitionVersion: number = EXPEDITION_DEFINITION_VERSION,
): ExpeditionDefinitionId {
  if (
    !isSafeNonNegativeInteger(runPrestige) ||
    !Number.isInteger(milestoneIndex) ||
    milestoneIndex < 0 ||
    milestoneIndex >= EXPEDITION_MILESTONE_COUNT
  ) {
    throw new RangeError('expedition milestone coordinates are outside the supported range')
  }

  const contract = getVersionedDefinitionContract(definitionVersion)
  const blockIndex = Math.floor(milestoneIndex / contract.definitionIds.length)
  const bagIndex = milestoneIndex % contract.definitionIds.length
  return getDefinitionBag(
    savedSeed,
    runPrestige,
    blockIndex,
    definitionVersion,
  )[bagIndex] as ExpeditionDefinitionId
}

function createVersionedExpeditionPendingEvent(
  savedSeed: number,
  runPrestige: number,
  milestoneIndex: number,
  rawMaxHpAtOffer: number,
  definitionVersion: number,
): ExpeditionPendingEvent {
  const definitionId = getExpeditionDefinitionForMilestone(
    savedSeed,
    runPrestige,
    milestoneIndex,
    definitionVersion,
  )
  const contract = getVersionedDefinitionContract(definitionVersion)
  const definition = contract.definitions[definitionId]
  const milestoneStage = (milestoneIndex + 1) * EXPEDITION_MILESTONE_INTERVAL
  const milestoneRank = milestoneStage / EXPEDITION_MILESTONE_INTERVAL
  const maxHpAtOffer = toSafeInteger(rawMaxHpAtOffer, 1)
  const seedHex = (savedSeed >>> 0).toString(16).padStart(8, '0')
  const resolvedChoices: readonly [ExpeditionResolvedChoice, ExpeditionResolvedChoice] = [
    {
      choiceId: 'gold',
      effect: {
        type: 'grantGold',
        amount: toSafeInteger(definition.goldCoefficient * milestoneRank),
      },
    },
    {
      choiceId: 'recovery',
      effect: {
        type: 'restoreHp',
        amount: toSafeInteger(maxHpAtOffer * definition.recoveryPercent / 100),
      },
    },
  ]

  return {
    eventId: `${contract.eventIdPrefix}:${seedHex}:${runPrestige}:${milestoneIndex}:${definitionId}`,
    definitionId,
    definitionVersion,
    milestoneIndex,
    milestoneStage,
    maxHpAtOffer,
    resolvedChoices,
  }
}

export function createExpeditionPendingEvent(
  savedSeed: number,
  runPrestige: number,
  milestoneIndex: number,
  rawMaxHpAtOffer: number,
): ExpeditionPendingEvent {
  return createVersionedExpeditionPendingEvent(
    savedSeed,
    runPrestige,
    milestoneIndex,
    rawMaxHpAtOffer,
    EXPEDITION_DEFINITION_VERSION,
  )
}

function pendingEventsMatch(
  left: ExpeditionPendingEvent,
  right: ExpeditionPendingEvent,
): boolean {
  if (!Array.isArray(left.resolvedChoices) || left.resolvedChoices.length !== 2) return false
  if (
    left.resolvedChoices.some(
      (choice) =>
        typeof choice !== 'object' ||
        choice === null ||
        typeof choice.effect !== 'object' ||
        choice.effect === null,
    )
  ) {
    return false
  }
  return (
    left.eventId === right.eventId &&
    left.definitionId === right.definitionId &&
    left.definitionVersion === right.definitionVersion &&
    left.milestoneIndex === right.milestoneIndex &&
    left.milestoneStage === right.milestoneStage &&
    left.maxHpAtOffer === right.maxHpAtOffer &&
    left.resolvedChoices.every((choice, index) => {
      const expected = right.resolvedChoices[index]
      return expected !== undefined &&
        choice.choiceId === expected.choiceId &&
        choice.effect.type === expected.effect.type &&
        choice.effect.amount === expected.effect.amount
    })
  )
}

function hasReachableQueueHistory(
  consumedMilestones: number,
  pendingMilestoneIndices: readonly number[],
  expectedOverflowCount: number,
): boolean {
  const retainedMilestones = new Set(pendingMilestoneIndices)
  let retainedCount = 0
  let states = new Set(['0:0'])

  for (let milestoneIndex = 0; milestoneIndex < consumedMilestones; milestoneIndex += 1) {
    const mustRetain = retainedMilestones.has(milestoneIndex)
    const nextStates = new Set<string>()

    for (const state of states) {
      const [overflowText, temporaryText] = state.split(':')
      const overflowCount = Number(overflowText)
      const temporaryCount = Number(temporaryText)

      for (let keptTemporary = 0; keptTemporary <= temporaryCount; keptTemporary += 1) {
        const queueSize = retainedCount + keptTemporary
        if (queueSize >= MAX_PENDING_EXPEDITION_EVENTS) {
          if (!mustRetain && overflowCount < expectedOverflowCount) {
            nextStates.add(`${overflowCount + 1}:${keptTemporary}`)
          }
          continue
        }

        nextStates.add(
          mustRetain
            ? `${overflowCount}:${keptTemporary}`
            : `${overflowCount}:${keptTemporary + 1}`,
        )
      }
    }

    if (mustRetain) retainedCount += 1
    states = nextStates
    if (states.size === 0) return false
  }

  for (const state of states) {
    const [overflowText] = state.split(':')
    if (Number(overflowText) === expectedOverflowCount) return true
  }
  return false
}

export function isValidExpeditionEventState(
  expeditionEvents: ExpeditionEventState,
  savedSeed: number,
  expectedRunPrestige: number,
  highestStage: number,
): boolean {
  if (
    !isSafeNonNegativeInteger(expeditionEvents.definitionVersion) ||
    !isSupportedExpeditionDefinitionVersion(expeditionEvents.definitionVersion) ||
    !isSafeNonNegativeInteger(expeditionEvents.runPrestige) ||
    (expectedRunPrestige !== undefined &&
      expeditionEvents.runPrestige !== expectedRunPrestige) ||
    !isSafeNonNegativeInteger(expeditionEvents.milestoneMask) ||
    expeditionEvents.milestoneMask > MAX_EXPEDITION_MILESTONE_MASK ||
    !Array.isArray(expeditionEvents.pending) ||
    expeditionEvents.pending.length > MAX_PENDING_EXPEDITION_EVENTS ||
    !isSafeNonNegativeInteger(expeditionEvents.overflowCount) ||
    expeditionEvents.overflowCount > EXPEDITION_MILESTONE_COUNT
  ) {
    return false
  }
  if (
    expeditionEvents.milestoneMask !==
    deriveLegacyExpeditionMilestoneMask(highestStage)
  ) {
    return false
  }

  let previousMilestoneIndex = -1
  const eventIds = new Set<string>()
  for (const pending of expeditionEvents.pending) {
    if (
      typeof pending !== 'object' ||
      pending === null ||
      !Number.isSafeInteger(pending.maxHpAtOffer) ||
      pending.maxHpAtOffer < 1 ||
      pending.milestoneIndex <= previousMilestoneIndex ||
      pending.definitionVersion !== expeditionEvents.definitionVersion ||
      !hasMilestone(expeditionEvents.milestoneMask, pending.milestoneIndex) ||
      eventIds.has(pending.eventId)
    ) {
      return false
    }

    let expected: ExpeditionPendingEvent
    try {
      expected = createVersionedExpeditionPendingEvent(
        savedSeed,
        expeditionEvents.runPrestige,
        pending.milestoneIndex,
        pending.maxHpAtOffer,
        pending.definitionVersion,
      )
    } catch {
      return false
    }
    if (!pendingEventsMatch(pending, expected)) return false

    eventIds.add(pending.eventId)
    previousMilestoneIndex = pending.milestoneIndex
  }

  let consumedMilestones = 0
  for (let index = 0; index < EXPEDITION_MILESTONE_COUNT; index += 1) {
    if (hasMilestone(expeditionEvents.milestoneMask, index)) consumedMilestones += 1
  }
  return hasReachableQueueHistory(
    consumedMilestones,
    expeditionEvents.pending.map(({ milestoneIndex }) => milestoneIndex),
    expeditionEvents.overflowCount,
  )
}

export function resolveReachedExpeditionMilestones(
  input: ExpeditionEventState,
  savedSeed: number,
  previousHighestStage: number,
  highestStage: number,
  maxHpAtOffer: number,
): ExpeditionEventState {
  const firstIndex = Math.max(
    0,
    Math.floor(Math.max(0, previousHighestStage) / EXPEDITION_MILESTONE_INTERVAL),
  )
  const lastIndexExclusive = Math.min(
    EXPEDITION_MILESTONE_COUNT,
    Math.floor(Math.max(0, highestStage) / EXPEDITION_MILESTONE_INTERVAL),
  )
  if (firstIndex >= lastIndexExclusive) return input

  let milestoneMask = input.milestoneMask
  let overflowCount = input.overflowCount
  const pending = [...input.pending]
  let changed = false

  for (let milestoneIndex = firstIndex; milestoneIndex < lastIndexExclusive; milestoneIndex += 1) {
    if (hasMilestone(milestoneMask, milestoneIndex)) continue
    changed = true
    milestoneMask = claimMilestone(milestoneMask, milestoneIndex)
    if (pending.length >= MAX_PENDING_EXPEDITION_EVENTS) {
      overflowCount = Math.min(EXPEDITION_MILESTONE_COUNT, overflowCount + 1)
      continue
    }
    pending.push(
      createVersionedExpeditionPendingEvent(
        savedSeed,
        input.runPrestige,
        milestoneIndex,
        maxHpAtOffer,
        input.definitionVersion,
      ),
    )
  }

  if (!changed) return input
  return { ...input, milestoneMask, pending, overflowCount }
}
