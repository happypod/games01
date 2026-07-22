# IRPG-701 — Schema 9·ITEM_REGISTRY·독립 마이그레이션

## Outcome

Schema 9 데이터 구조, 고정 아이템 레지스트리(`ITEM_REGISTRY`), 및 V1~V8 저장소의 독립 디코더/마이그레이션 모듈을 구현하고 검증한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Verify
- Skill tags: ENG-STATE, ENG-SAVE, QA-DOMAIN
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- `src/game/types.ts`: `SAVE_VERSION` = 9, `INVENTORY_DEFINITION_VERSION` = 1, `EquipmentSlot`, `ItemRarity`, `ItemType`, `ItemStats`, `ItemDefinition`, `InventoryState`, `PlayerEquippedState`, 정확히 3칸인 `SkillSlotState` tuple 정의
- `src/game/itemRegistry.ts`: own-key lookup만 허용하는 deep-frozen `ITEM_REGISTRY` 수록 (무기, 갑옷, 투구, 장신구 기본 및 희귀 아이템 7종)
- `src/game/persistence.ts`: 현재 `GameState`를 재사용하거나 전체 객체를 spread하지 않는 V1~V8 legacy 타입·validator·migration. Schema 8 ➔ 9 디코딩 시 `inventory`, `equipped`, `skillSlots` 및 `powerStrike` 0번 슬롯만 기본 추가
- Schema 9 strict decoder: plain ID-count record, registry own ID, present count `1..MAX_SAFE`(0은 key 삭제), 장비 slot 일치, 정확히 3개의 지원·고유 skill slot 검증
- state·expedition·camp·bond·inventory definition future fence와 schema8 camp definition v3 매핑
- `src/game/engine.ts`: `createInitialState` 및 `cloneState`에 `inventory`, `equipped`, `skillSlots` 추가
- `src/game/persistence.test.ts`: Schema 8 ➔ 9 마이그레이션 및 전체 회귀 테스트 통과

## Non-scope

- 전리품 드롭/이관 엔진 명령 (IRPG-702에서 진행)
- 능동 스킬 슬롯 시전 런타임 (IRPG-704에서 진행)
- UI 레이아웃 구현 (IRPG-703에서 진행)

## Dependencies

- IRPG-700 (인벤토리·장비·스킬 제품 범위 및 상태 계약)

## Impacts

- Save schema: Migration required (`SAVE_VERSION` 8 ➔ 9)
- Content config: `ITEM_REGISTRY` 추가
- Accessibility: N/A

## Acceptance criteria

- Given a Schema 8 save state, when decoded via `parseSave`, then `schemaVersion` becomes 9, `inventory` has 3 empty ID maps, `equipped` slots are all `null`, and legacy `powerStrike` rank가 0이어도 `skillSlots[0]` is `'powerStrike'`.
- Given malformed Schema 9 inventory/equipment/skill data, when decoded from A/B, then it is rejected and the previous valid slot may recover without fabricating values.
- Given a higher state, expedition, camp, bond, or inventory definition version, when found in raw/A/B/portable data, then all writes are blocked and the original bytes are retained. A valid Schema 8 camp definition v3 is not classified as future.
- Given any legacy save (V1~V8), when imported, then it migrates deterministically without corrupting RNG state or existing player progress.
- Given unknown Schema 9-shaped fields injected into V1~V8 input, when migrated, then legacy allow-list copying discards them and the final Schema 9 state passes `isGameState`.

## Verification

- `npx vitest run src/game/persistence.test.ts src/game/campPersistence.test.ts --maxWorkers=2`: 2파일·82/82 통과.
- Schema 8 rank 0 슬롯 유실, malformed Schema 9 A/B fallback, future inventory raw/A/B/portable fence, V1~V8 nested unknown-field 누출을 회귀로 재현한 뒤 모두 보정했다. 모든 역사 branch는 player·camp·battle·RNG·stats·expedition nested field를 allow-list로 복사한다.
- 독립 재검토에서 P0/P1/P2 잔여가 없어 `Verify`로 승인했다. 전체 로컬 코드 게이트는 Vitest 51파일·482/482, asset validator 40/40, manifest 31 ID, lint·typecheck·production build를 통과했다. 원격 Ubuntu quality gate 전에는 `Test`/`Done`으로 전환하지 않는다.

## Test evidence

- `src/game/persistence.test.ts`
  - `migrates Schema 8 to Schema 9 with powerStrike in slot 0 regardless of legacy rank`
  - `copies only allow-listed nested Schema 8 fields into Schema 9`
  - malformed Schema 9 inventory·equipment·skill A/B fallback과 future inventory raw·A/B·portable write fence
  - strict registry ID·slot·skill tuple validation and A/B fallback
  - Schema 8 camp v3 acceptance and future inventory/camp/bond/state write fences
  - legacy injected-field discard followed by final Schema 9 validation
  - `migrates the checked-in v1 fixture to a verified current-schema envelope with a stable RNG`
  - `migrates schema2 without changing its saved RNG sequence`
