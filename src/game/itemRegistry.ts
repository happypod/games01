import type { ItemDefinition } from './types'

const RAW_ITEM_REGISTRY = {
  'weapon.novice-sword': {
    id: 'weapon.novice-sword',
    name: '수련자의 검',
    rarity: 'COMMON',
    type: 'EQUIPMENT',
    slot: 'weapon',
    stats: { atk: 5 },
    assetId: 'equipment.ember-blade',
    description: '기초적인 단조 과정을 거친 날카로운 직도입니다.',
  },
  'armor.novice-vest': {
    id: 'armor.novice-vest',
    name: '수련자의 누비옷',
    rarity: 'COMMON',
    type: 'EQUIPMENT',
    slot: 'armor',
    stats: { hp: 30, def: 2 },
    assetId: 'equipment.guard-armor',
    description: '충격을 줄여주는 견고한 누비 가죽옷입니다.',
  },
  'helmet.novice-helm': {
    id: 'helmet.novice-helm',
    name: '수련자의 투구',
    rarity: 'COMMON',
    type: 'EQUIPMENT',
    slot: 'helmet',
    stats: { hp: 20, def: 1 },
    assetId: 'equipment.guard-armor',
    description: '머리를 보호하는 기본적인 철제 투구입니다.',
  },
  'accessory.novice-ring': {
    id: 'accessory.novice-ring',
    name: '수련자의 반지',
    rarity: 'COMMON',
    type: 'EQUIPMENT',
    slot: 'accessory',
    stats: { critChanceBasisPoints: 200 },
    assetId: 'equipment.fortune-charm',
    description: '급소를 노릴 집중력을 올려주는 링입니다.',
  },
  'weapon.ember-blade': {
    id: 'weapon.ember-blade',
    name: '잔불의 검',
    rarity: 'RARE',
    type: 'EQUIPMENT',
    slot: 'weapon',
    stats: { atk: 25 },
    assetId: 'equipment.ember-blade',
    description: '불꽃의 온기가 남아 있는 기사단 장검입니다.',
  },
  'armor.guard-armor': {
    id: 'armor.guard-armor',
    name: '수호 기사 갑옷',
    rarity: 'RARE',
    type: 'EQUIPMENT',
    slot: 'armor',
    stats: { hp: 100, def: 10 },
    assetId: 'equipment.guard-armor',
    description: '경비 대원이 착용하던 중형 판금 갑옷입니다.',
  },
  'accessory.fortune-charm': {
    id: 'accessory.fortune-charm',
    name: '행운의 부적',
    rarity: 'RARE',
    type: 'EQUIPMENT',
    slot: 'accessory',
    stats: { critChanceBasisPoints: 500 },
    assetId: 'equipment.fortune-charm',
    description: '치명적인 일격을 이끌어내는 신비한 부적입니다.',
  },
} as const satisfies Readonly<Record<string, ItemDefinition>>

export type RegisteredItemId = keyof typeof RAW_ITEM_REGISTRY

function freezeItemDefinition(definition: ItemDefinition): Readonly<ItemDefinition> {
  if (definition.stats === undefined) return Object.freeze({ ...definition })
  return Object.freeze({
    ...definition,
    stats: Object.freeze({ ...definition.stats }),
  })
}

export const ITEM_REGISTRY = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW_ITEM_REGISTRY).map(([id, definition]) => [
      id,
      freezeItemDefinition(definition),
    ]),
  ),
) as Readonly<Record<RegisteredItemId, Readonly<ItemDefinition>>>

export function isRegisteredItemId(id: string): id is RegisteredItemId {
  return Object.prototype.hasOwnProperty.call(ITEM_REGISTRY, id)
}

export function getItemDefinition(id: string): Readonly<ItemDefinition> | null {
  return isRegisteredItemId(id) ? ITEM_REGISTRY[id] : null
}
