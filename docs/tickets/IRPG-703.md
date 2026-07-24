# IRPG-703 — 캐릭터 장비창·인벤토리·스킬 슬롯 UI

## Outcome

전술 정보 레일 및 8슬롯 하단 액션바와 완벽히 연동되는 부위별 캐릭터 장비창(무기·투구·갑옷·장신구), 삼원 가방(임시 전리품/영웅 가방/캠프 보관함) Grid UI 및 3슬롯 능동 스킬 배치 팝업/패널 UI를 제공하여 파밍, 빌드 및 장비 탈착 UX를 완성한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: FE-GAME, UX-FEEDBACK, A11Y, QA-E2E
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- **`src/components/InventoryPanel.tsx` (신규/수정)**:
  - 삼원 인벤토리 (전투 임시 전리품 가방, 영웅 가방, 캠프 보관함) 탭/섹션 Grid UI
  - 전리품 개별/전체 캠프 보관함 이관 버튼
  - 영웅 가방 ↔ 장비창 1개 단위 이동 및 착용/해제 인터랙션
- **`src/components/EquipmentPanel.tsx` (신규/수정)**:
  - 부위별 장비 슬롯 (weapon, helmet, armor, accessory) UI
  - 현재 착용 장비의 파생 스탯 (공격력, 방어력, 체력, 치명타율) 요약 툴팁 및 표시
  - 장비 클릭 시 즉시 해제 및 가방 반환 (가방 가득 참 시 비활성화/경고)
- **`src/components/SkillSlotPanel.tsx` (신규/수정)**:
  - 3개 능동 스킬 슬롯 UI 및 장착 가능 스킬 목록
  - 스킬 선택 시 슬롯 배치/해제/스왑 조작 및 쿨다운 표시
- **전술 정보 레일 & 액션바 연동 (`TacticalIntelPanel.tsx`, `TacticalActionBar.tsx`)**:
  - 가방/장비/스킬 모달 또는 패널 토글 연동 및 키보드 접근성(A11Y) 보장

## Non-scope

- 신규 장비 아이콘 아트 작업 (기존 fallback/GameAsset 시스템 활용)
- 3D/동적 소켓 착용 아바타 렌더링

## Dependencies

- IRPG-701 (Schema 9·ITEM_REGISTRY·독립 마이그레이션)
- IRPG-702 (장비 드롭·이관·이동·장착·스탯 엔진)
- IRPG-704 (능동 스킬 슬롯 실행 및 연동 계약)

## Impacts

- Save schema: Schema 9 (`inventory`, `equipped`, `skillSlots`)
- Accessibility: 키보드 roving tabindex, 모달 포커스 트랩 및 aria 태그

## Acceptance criteria

- Given the player opens the inventory disclosure, when switching tabs between Loot Bag, Hero Inventory, and Camp Storage, then the stored items with counts are accurately rendered in a grid layout.
- Given items in the Loot Bag, when clicking "Settle to Camp Storage", then items transfer to Camp Storage without exceeding `MAX_SAFE_INTEGER` or capacity limits.
- Given equipment in Hero Inventory, when clicking an item, then it equips to its designated slot, updates hero stats dynamically, and unequips any existing item in that slot back to inventory.
- Given active skill slots in SkillSlotPanel, when assigning an unlocked skill to slot 0, 1, or 2, then the skill is set, and duplicate assignment in another slot is cleared/swapped.
- Given keyboard navigation, when accessing equipment, inventory, and skill panels, then all controls are operable via keyboard focus without horizontal scroll/clipping.

## Verification

- `npm run verify` 전체 검증 통과.

## Test evidence

- `src/components/InventoryPanel.test.tsx` (또는 UI 관련 테스트) 및 E2E 테스트 통과.
