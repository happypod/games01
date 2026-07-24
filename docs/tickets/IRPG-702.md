# IRPG-702 — 장비 드롭·이관·이동·장착·스탯 엔진

## Outcome

결정론적 전리품 가방 이관(`settleLootAtCamp`), 1개 단위 장비 탈착/교환(`equipItem`, `unequipItem`), 가방-보관함 간 수량 이동(`moveItem`), 파생 스탯 및 HP 클램핑을 구현하고 수식 검증을 통과한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ENG-SIM, ENG-STATE, GD-BAL
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- `src/game/formulas.ts`: `getHeroStats`에 부위별 장착 장비 수치(`atk`, `hp`, `def`) 플랫 합산 반영
- `src/game/itemRegistry.ts`: deep-frozen 고정 장비 7종 정의와 own-key lookup
- `src/game/lootRegistry.ts`: deep-frozen `equipment-loot-v1` COMMON 4종·RARE 3종 table 및 encounter substream
- `src/game/engine.ts`:
  - 모든 처치 공통 분기: 일반 적 15%·보스 100%의 encounter-identity 장비 드롭을 `lootBag`에 지급하되 기존 1 draw/round 외 전투 RNG draw 불변
  - `settleLootAtCamp(input)`: `lootBag`의 전리품 수량을 `campStorage` 여유만큼 합산하고 포화 잔여 보존
  - `switchGameMode('CAMP')`: 모드 전환 시 `settleLootAtCamp` 자동 호출
  - `advanceOfflineGame`: `CAMP` 모드 복원 시 오프라인 정산 후 `settleLootAtCamp` 자동 호출
  - `equipItem(input, slot, itemId)`: 가방 수량 1 차감, 슬롯에 장착, 기존 장비 가방 반환, HP 클램핑
  - `unequipItem(input, slot)`: 장비 해제 후 가방으로 1개 반환, HP 클램핑
  - `moveItem(input, source, target, itemId, amount)`: CAMP 모드에서 registry own ID만 허용하는 `heroInventory`와 `campStorage` 간 안전한 수량 이동
  - 집중 물약: 장비 치명타 보너스와 무관하게 bound 보스의 최종 임계값을 정확히 35%로 설정
  - `performPrestige(input)`: 환생 시 인벤토리, 착용 상태, 스킬 슬롯 deep-clone 유지
  - 환생 뒤 신규 원정 기본 스킬 rank(`powerStrike` 1, 나머지 0)와 보존된 슬롯 배치의 분리
- `src/game/engine.test.ts`: 스탯 파생, 장비 탈착/교환, 이동, 전리품 이관 단위 테스트 추가

## Non-scope

- 능동 스킬 슬롯 순서·빈 슬롯을 시전 게이트로 사용하는 런타임 (IRPG-704에서 진행)
- 장비 UI 및 슬롯 컴포넌트 바인딩 (IRPG-703에서 진행)

## Dependencies

- IRPG-701 (Schema 9·ITEM_REGISTRY·독립 마이그레이션)

## Impacts

- Save schema: Compatible (Schema 9 구조 활용)
- Content config: immutable `equipment-loot-v1` 드롭 테이블
- Accessibility: N/A

## Acceptance criteria

- Given equipped items with `atk: 5, hp: 30, def: 2`, when `getHeroStats` is calculated, then attack, maxHp, and defense increase by exact amounts.
- Given items in `heroInventory`, when `equipItem` is executed, then the item is moved to `equipped[slot]` and any prior equipped item is returned to `heroInventory`.
- Given items in `lootBag`, when entering `CAMP` mode or settling offline progress in `CAMP` mode, then available quantities transfer to `campStorage` and `lootBag` clears only when no saturation remainder exists.
- Given a nearly saturated `campStorage`, when loot is settled or moved, then only available capacity moves and every untransferred item remains in its source.
- Given regular and boss defeats from the same starting state, when executed single, split, offline, or after reload, then the exact item IDs/counts repeat and loot consumes no combat RNG draw beyond the existing one draw per round.
- Given a critical accessory and an active focus tonic on its bound boss, when the attack roll resolves, then the final threshold is exactly 35%.
- Given a prestige reset, when `performPrestige` is called, then `inventory`, `equipped`, and `skillSlots` remain intact.
- Given a prestige reset, when combat continues before IRPG-704, then the slot tuple remains saved while legacy automatic skill execution continues to follow the reset rank (`powerStrike` 1, the others 0), not slot order.

## Verification

- `npx vitest run src/game/engine.test.ts --maxWorkers=2`: 38/38 통과.
- 저장·엔진·집중 물약 표적 묶음은 4파일·127/127, 전체 로컬 코드 게이트는 51파일·482/482를 통과했다. 일반 Playwright 65/65와 production asset 6/6도 통과했다.
- 독립 리뷰에서 발견한 `moveItem` prototype ID 손상, 잘못된 이동 경로, `unequipItem` runtime slot 우회를 보정했다. 재검토 결과 P0/P1/P2 잔여가 없어 `Verify`로 승인했고 [PR quality `29944192954`](https://github.com/happypod/games01/actions/runs/29944192954)가 Ubuntu 전체 게이트를 통과해 `Test`로 전환한다. 간접 선행인 IRPG-424의 외부 보조공학 감사와 최종 병합 검토 전에는 `Done`으로 전환하지 않는다.

## Test evidence

- `src/game/engine.test.ts`:
  - `incorporates equipped item stats into getHeroStats and clamps HP when equipping/unequipping`
  - `atomically swaps equipped items and returns the previous item to the hero inventory`
  - `moves items between heroInventory and campStorage in CAMP mode`
  - `rejects unregistered and prototype item IDs without mutating inventory state`
  - `partially moves only the target capacity and preserves the source remainder`
  - `settles loot from lootBag into campStorage when switching to CAMP mode and during offline CAMP progress`
  - `uses an exact 35% focus-tonic critical threshold regardless of equipment bonus`
  - `grants an exact deterministic boss drop once without consuming the combat RNG substream`
  - `applies the regular 15% table by encounter identity and is single/split/offline deterministic`
  - `preserves unsettled loot at MAX_SAFE_INTEGER without mutating the source state`
