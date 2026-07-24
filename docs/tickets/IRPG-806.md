# IRPG-806 — 캐릭터 탭 동시 표시 레이아웃 (IRPG-703 시각 재구성)

## Outcome

《Raid: Shadow Legends》 챔피언 장비창 스크린샷을 참조해, `TacticalIntelPanel`의 "캐릭터" 탭을 세로로 순차 스크롤하는 현재 레이아웃에서 초상화+스탯과 부위별 장비 슬롯을 한 화면에서 동시에 보는 레이아웃으로 재구성한다. IRPG-703이 이미 구현한 장착/해제/스탯 계산 로직과 접근성은 전혀 건드리지 않는다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: FE-GAME, UX-FEEDBACK, A11Y
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- `src/components/TacticalIntelPanel.tsx`의 `activeTab === 'character'` 렌더 블록(부위별 장착 장비 그리드 + 스탯 표시부, 대략 295~340번 라인 부근)을 2단 컬럼 레이아웃으로 감싼다: **좌측** 영웅 초상화 + 파생 스탯(HP/ATK/DEF/치명타 등, 기존 `getHeroStats` 결과 그대로), **우측** 기존 "부위별 장착 장비" 그리드(`EQUIPMENT_SLOTS.map(...)`)와 장비 선택 `<dialog>`. 두 컬럼은 마크업과 CSS만 재배치할 뿐, `onEquipItem`/`onUnequipItem` 등 기존 핸들러와 props 시그니처는 그대로 사용한다.
- 좌측에 영웅과 동료(`emberFox`/루미) 2개 요약 카드를 나란히 배치해 Raid의 "챔피언 로스터" 개념을 아주 작게 반영한다(아래 Non-scope 참고 — 여러 캐릭터 그리드가 아니라 딱 2장).
- `src/styles.css`: 새 2단 컬럼용 클래스 추가, 360px 모바일에서는 자동으로 1단 세로 스택으로 되돌아가는 반응형 규칙 포함(현재도 모바일 지원이 요구사항이므로 회귀 금지).

## Non-scope

- **다수 챔피언 로스터 그리드** — Emberwatch는 영웅 1명(아렌) + 동료 1종(루미)뿐이라 Raid처럼 4열 x 6행 로스터 그리드가 채울 콘텐츠가 없다. 로스터 그리드를 억지로 만들지 않는다.
- 스킬 슬롯 탭(`activeTab === 'skills'`)과 가방 탭(`activeTab === 'inventory'`) 레이아웃 변경 — 이번 티켓은 "캐릭터" 탭 한정.
- 장비 스탯 계산식, 장착/해제 판정, 저장 스키마 — IRPG-701/702/704가 이미 Done이며 이번 티켓은 시각 재배치만 다룬다.
- 신규 장비 아이콘 아트.

## Dependencies

- IRPG-703 (캐릭터 장비창·인벤토리·스킬 슬롯 UI), IRPG-701, IRPG-702, IRPG-704, IRPG-403 (접근성·모바일 감사)

## Impacts

- Save schema: none
- Content config: none
- Accessibility: review 필요 — 기존 키보드 포커스 순서(roving tabindex, 모달 포커스 트랩)가 2단 컬럼 재배치 후에도 논리적 순서(좌→우, 위→아래)를 유지하는지 재확인.

## Acceptance criteria

- Given "캐릭터" 탭, when 데스크톱 폭(1024px 이상)에서 열면, then 초상화+스탯과 장비 슬롯이 스크롤 없이 한 화면에 동시에 보인다.
- Given 360px 모바일 폭, when 같은 탭을 열면, then 1단 세로 스택으로 자동 전환되고 가로 스크롤이 발생하지 않는다(기존 IRPG-403 기준 유지).
- Given 장비 슬롯 클릭, when 장착/해제를 실행하면, then IRPG-703과 완전히 동일한 `onEquipItem`/`onUnequipItem` 호출과 결과가 발생한다(로직 변경 없음, 회귀 테스트로 확인).
- Given 키보드 사용자, when Tab으로 순회하면, then 좌측 스탯 영역 → 우측 장비 그리드 순으로 논리적으로 이동하고 기존 모달 포커스 트랩이 그대로 동작한다.
- Given 기존 `TacticalIntelPanel.test.tsx`, when 이 티켓 이후 실행하면, then 전부 그대로 통과한다(마크업 재배치가 테스트가 의존하는 role/label을 깨지 않음).

## Design

- 순수 레이아웃/CSS 변경으로 한정한다. 데이터 흐름이나 상태 관리 코드는 옮기지 않고, JSX 트리 구조와 클래스만 조정한다.
- 동료 요약 카드는 장비 대상이 아니라 참고용 표시(협공 데미지, 랭크)만 하고 클릭 인터랙션을 새로 만들지 않는다 — 동료 육성은 이미 액션바에 있는 기존 훈련 명령을 그대로 쓴다.

## Verification

- 코드 리뷰: 기존 `TacticalIntelPanel.test.tsx`가 수정 없이 통과하는지로 "로직 무변경"을 검증.

## Test evidence

- 기존 `src/components/TacticalIntelPanel.test.tsx` 전체 통과
- 신규 레이아웃 관련 테스트(있다면) 및 `npm run test:e2e:visual` 신규 baseline
- `npm run verify` 통과 로그
