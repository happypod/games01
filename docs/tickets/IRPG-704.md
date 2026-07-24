# IRPG-704 — 능동 스킬 슬롯 실행 및 연동 계약

## Outcome

3개 슬롯에 장착된 능동 스킬이 전투 시계(Combat Clock) 및 자동 전투 루프와 연동되어 시전 및 쿨다운이 처리되고, 스킬 슬롯 장착·해제·교체 엔진 명령을 제공한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: GD-SKILL, ENG-SIM, ENG-STATE
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- `src/game/engine.ts`:
  - `equipSkillSlot(input, slotIndex, skillId)`: 특정 슬롯(0~2)에 유효 스킬 장착 (해금 레벨 및 랭크 >= 1 검증, 타 슬롯 중복 배치 시 자동 이동/스왑)
  - `unequipSkillSlot(input, slotIndex)`: 특정 슬롯(0~2)의 스킬 장착 해제
  - `resolveCombatRound()` / `advanceGame()`: `player.skillSlots`에 배치된 능동 스킬만 전투 시계 주기 시전 허용 (미장착 스킬 시전 차단)
- `src/game/engine.test.ts`: 능동 스킬 슬롯 장착·해제·스왑 및 미장착 시 발동 차단 검증 단위 테스트

## Non-scope

- 능동 스킬 UI 컴포넌트 및 액션바 바인딩 (IRPG-703에서 진행)
- 신규 스킬 추가 및 밸런스 패치

## Dependencies

- IRPG-701 (Schema 9·ITEM_REGISTRY·독립 마이그레이션)
- IRPG-702 (장비 드롭·이관·이동·장착·스탯 엔진)

## Impacts

- Save schema: Schema 9 `skillSlots` 활용
- Content config: `SKILL_DEFINITIONS`
- Accessibility: N/A

## Acceptance criteria

- Given an unlocked skill, when calling `equipSkillSlot`, then the skill is placed in the designated slot (0, 1, or 2), and any prior slot containing the same skill is cleared.
- Given a locked skill (rank 0 or level unmet), when calling `equipSkillSlot`, then the operation is rejected and the state remains unchanged.
- Given an equipped active skill (`powerStrike`), when combat rounds advance, then it triggers upon cooldown completion and resets its cooldown.
- Given an unequipped active skill, when combat rounds advance, then the active skill does not activate even if its rank is >= 1.
- Given calling `unequipSkillSlot`, then the specified slot becomes `null`.

## Verification

- `npm run verify:code` 및 `npm run verify` 통과.

## Test evidence

- `src/game/engine.test.ts`
