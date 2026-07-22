# IRPG-700 — 인벤토리·장비·스킬 제품 범위 및 상태 계약

## Outcome

삼원 구조 인벤토리(전리품 가방, 캠프 보관함, 캐릭터 가방), 부위별 장치 슬롯(무기, 갑옷, 투구, 장신구), 3슬롯 능동 스킬 배치 시스템의 제품 범위, 저장 구조, 스탯 수식 및 마이그레이션 계약을 확정한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Test
- Skill tags: PROD-LOOP, ENG-STATE, GD-BAL, ENG-SAVE
- Owner / Reviewer: Project Owner / Lead Builder

## Scope

- 삼원 구조 인벤토리 데이터 모델 (`GameState.inventory`: `definitionVersion`, `lootBag`, `heroInventory`, `campStorage`)
- 저장소 내 아이템 representation: `Record<ItemId, number>` ID 수량 맵 기반 (객체·무작위 옵션 저장 금지)
- 고정 `ITEM_REGISTRY` 정의 (ID별 `name`, `rarity`, `slot`, `stats`, `assetId`)
- 부위별 장착 상태 (`PlayerState.equipped`: `weapon`, `armor`, `helmet`, `accessory`)
- 능동 스킬 슬롯 (`PlayerState.skillSlots`: 3개 슬롯)
- `settleLootAtCamp()` 공용 이관 메커니즘 (모드 전환 및 오프라인 CAMP 복원 정산)
- immutable `equipment-loot-v1`: 일반 적 매 처치 15% COMMON 4종 균등, 보스 매 처치 100% RARE 3종 균등 지급
- 저장 seed·처치 ordinal·stage·보스 여부의 encounter identity를 쓰는 전투 RNG 독립 substream과 single/split/offline/reload 반복 정책
- 안전 정수 포화 시 이관·이동 잔여를 source에 보존하고 장비 교환·해제는 공간 부족 시 원자 거절하는 총량 보존 정책
- 일반 전투는 기본 15%에 장비 치명타 보너스를 반영하고 집중 물약 보스전은 장비와 무관하게 정확히 35%를 쓰는 임계값 정책
- 환생 시 `inventory`·`equipped`·`skillSlots` 보존
- Schema 8 ➔ Schema 9 마이그레이션 계약 (`powerStrike` -> `skillSlots[0]` 자동 할당)

## Non-scope

- 무작위 수치 부여 / 가챠 / 옵션 교배 (고정 `ITEM_REGISTRY`만 허용)
- 기존 재료(`camp.materials`) 및 소모품(`camp.consumables`)의 전리품 가방 이송 (장비 전용)
- UI 컴포넌트 구현 (IRPG-703에서 진행)

## Dependencies

- IRPG-424 (전술 정보 레일)
- IRPG-428 (Ubuntu visual gate)

## Impacts

- Save schema: Migration required (`SAVE_VERSION` 8 ➔ 9)
- Content config: `ITEM_REGISTRY` 추가
- Accessibility: N/A

## Acceptance criteria

- Given a Schema 8 save state, when decoded by the engine, then `SAVE_VERSION` becomes 9, `inventory` and `equipped` are initialized, and `powerStrike` is placed in `skillSlots[0]`.
- Given items in `lootBag`, when entering `CAMP` mode or settling offline progress in `CAMP` mode, then available capacity is deterministically added to `campStorage`, successfully moved amounts are removed, and saturation remainder stays in `lootBag`.
- Given an equipped item with bonus stats, when `getHeroStats` is called, then flat bonus stats from `ITEM_REGISTRY` are added, and `currentHp` is clamped within `[1, maxHp]`.
- Given the same saved state and encounter sequence, when combat runs single, split, offline, or across reload, then `equipment-loot-v1` produces the same item IDs/counts while combat keeps its existing one draw per round and loot adds no combat RNG draw.
- Given a focused boss while a critical accessory is equipped, when its attack roll resolves, then the final critical threshold is exactly 35%, not 35% plus the equipment bonus.
- Given a prestige reset, when it succeeds, then all three inventory maps, four equipped slots, and three skill slots remain identical without aliasing or extra grants.

## Verification

- 2026-07-23 독립 제품·저장·엔진 리뷰에서 발견한 migration 슬롯 유실, prototype 명령 경계와 계약 불일치를 보정했고 재검토 결과 P0/P1/P2 잔여가 없어 `Verify`로 승인했다.
- 로컬 게이트: `npm run verify:code`에서 Vitest 51파일·482/482, asset validator 40/40, manifest 31 ID, lint·typecheck·production build를 통과했다. Chromium Playwright는 일반 65/65와 production asset 6/6을 통과했다.
- 누락됐던 `visual.camp.bond-synthesis-reward` 4개 로컬 후보를 생성해 원본 검토로 승인하고 신규 4개 × 3회 비교 12/12를 통과시켰다. 이후 Ubuntu canonical artifact를 기준으로 전체 76개를 재대조해 동일 16개·의도 변경 60개·추가/누락 0개를 확정했다.
- Windows 강제 전체 비교는 비canonical raster 차이를 재현하므로 승인 증거로 쓰지 않는다. Ubuntu tracked `76/76`, canonical 생성 `76/76`, 3회 반복 `228/228`과 artifact 수동 검토를 완료해 `Test`로 전환한다. IRPG-424·428의 잔여 수동 감사와 최종 병합 검토 전에는 `Done`으로 전환하지 않는다.

## Test evidence

- `src/game/persistence.test.ts`
- `src/game/engine.test.ts`
- [PR quality `29944192954`](https://github.com/happypod/games01/actions/runs/29944192954): Vitest `482/482`, 일반 Playwright `65/65`, production asset `6/6`, Ubuntu tracked visual `76/76` 통과
- [Ubuntu visual `29944190250`](https://github.com/happypod/games01/actions/runs/29944190250): canonical `76/76`, 3회 반복 `228/228`, artifact `8539741608`
