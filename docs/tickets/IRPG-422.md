# IRPG-422 — 전술 전장 단일화·전투 슬롯바·유틸리티 도크

## Outcome

사용자가 하나의 전술 전장 화면에서 장비·스킬·보급품을 빠르게 확인하고 실행하며, 보조 기능은 간결한 아이콘 도크에서 필요할 때만 열어 사용한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: In Progress
- Skill tags: FE-GAME, UX-FEEDBACK, A11Y, QA-E2E, REL-CI
- Owner / Reviewer: Codex / independent UI, accessibility and regression review

## Scope

- 유형 1 대시보드와 레이아웃 선택 상태를 제거하고 유형 2 전술 전장을 전투 모드의 단일 화면으로 사용한다.
- 캠프는 전투와 별도의 기존 모드로 유지하고 전투·캠프 전환만 헤더에 남긴다.
- 불씨 검·수호 갑옷·행운 부적·화염 강타·강철 의지·전리품 감각의 실제 manifest 자산을 전장 슬롯바에 정확히 매핑한다.
- 슬롯 클릭 시 현재 단계, 다음 효과, 비용, 잠김·부족·최대 상태와 기존 강화/각인 명령을 한 번만 실행할 수 있는 상세 패널을 제공한다.
- 황금 스튜·집중 물약은 전투 중 즉시 소비하지 않고 캠프에서 준비해야 한다는 기존 명령 계약을 유지하면서 수량·버프 상태와 캠프 이동 동작을 슬롯바에서 제공한다.
- 전투 로그·승패 결과·불씨의 계승·저장 백업을 Font Awesome 아이콘 도크로 축약하고 hover/focus 설명과 클릭 상세·실행 패널을 제공한다.
- 360px, 1024px, 1440px, 200% 확대와 모션 감소에서 전장 우선순위·포커스·오버플로를 고도화한다.

## Non-scope

- 전투 수식, RNG, 보상, 환생 수식, 저장 schema 또는 migration 변경
- 수동 스킬 시전, 전투 중 캠프 소모품 사용 허용, 새 인벤토리·아이템 효과 추가
- 신규 일러스트 생성, 서버·결제·소셜 기능
- 캠프 대시보드 제거 또는 캠프 기능 재설계

## Dependencies

- IRPG-304, IRPG-403, IRPG-409, IRPG-410, IRPG-411, IRPG-414, IRPG-415, IRPG-417, IRPG-418, IRPG-420, IRPG-506
- 기존 18개 visual fixture와 실제 manifest 자산 resolver

## Impacts

- Save schema: none; 기존 `GameState`와 portable save byte/hash 불변
- Content config: none; 기존 upgrade/skill/consumable 정의만 표시
- UI preference: `emberwatch.ui.layout.v1`을 더 이상 읽거나 쓰지 않으며 저장 게임에는 영향 없음
- Dependency: Font Awesome React 및 solid icon 패키지 추가
- Accessibility: icon tooltip·popover 이름, 44px target, roving/focus return, Escape, reduced motion 검토 필요

## Acceptance criteria

- Given 전투 모드와 과거 layout preference 값이 있을 때, when 화면을 열면, then 유형 1 selector와 `.game-dashboard` 없이 `.tactical-layout` 하나가 표시되고 캠프 전환은 그대로 동작한다.
- Given 여섯 장비·스킬 슬롯일 때, when 자산을 resolve하면, then 각각 `equipment.ember-blade`, `equipment.guard-armor`, `equipment.fortune-charm`, `skill.power-strike`, `skill.iron-will`, `skill.loot-sense`를 중복·오매핑 없이 표시한다.
- Given 장비·스킬 슬롯의 available, locked, insufficient, max, globally-disabled 상태일 때, when 슬롯과 상세 동작을 사용하면, then 상태 이유와 기존 비용·효과 비교가 표시되고 허용된 명령만 클릭 한 번당 정확히 한 번 호출된다.
- Given 황금 스튜·집중 물약 슬롯일 때, when 전투 화면에서 선택하면, then 보유 수량·활성 버프·캠프 준비 조건을 표시하고 소비 명령 대신 캠프 이동만 제공한다.
- Given 네 유틸리티 아이콘일 때, when hover/focus/click/Escape/다른 아이콘을 사용하면, then 설명 tooltip이 노출되고 한 상세 패널만 열리며 Escape 뒤 트리거로 포커스가 돌아가고 내부의 결과 보기·환생·내보내기·가져오기 동작이 유지된다.
- Given 360×800, 1024×768, 1440×900, effective 360px/200%와 reduced-motion일 때, when 전투·슬롯·도크를 조작하면, then 페이지 가로 overflow가 없고 44px target·읽기 순서·정적 모션 대체를 유지한다.
- Given 기존 저장·전투 fixture일 때, when code·browser·asset·visual gate를 실행하면, then 저장 canonical과 전투 결과는 불변이고 의도적으로 바뀐 전술 단일 화면 baseline만 검토 가능하게 갱신된다.

## Design

`GameScreen`은 `currentMode`만으로 캠프와 전투를 분기한다. 전투에서는 `TacticalStage`와 성장 센터를 유지하되 전장 하단에 별도 `TacticalActionBar`를 합성한다. 장비·스킬 슬롯은 기존 content/formula selector로 순수 view model을 만들고 상세 버튼에서 기존 `buyUpgrade`·`buySkill`을 호출한다. 자동 스킬은 `AUTO`로 표시하며 수동 시전 상태를 새로 만들지 않는다. 캠프 전용 소모품은 전투에서 소비하지 않고 `changeMode('CAMP')`만 제공한다.

우측 보조 기능은 `TacticalUtilityDock`의 네 icon button과 하나의 non-modal popover로 합친다. tooltip은 hover/focus에, 상세와 실행 버튼은 click에만 보인다. popover는 한 번에 하나만 열고 Escape·외부 클릭에서 닫으며 키보드 포커스를 원래 trigger로 되돌린다. 기존 로그·결과·환생·백업 컴포넌트는 compact surface 안에서 재사용해 저장과 보상 명령의 단일 진입점을 보존한다.

## Verification

- 구현 전 검토: 저장·RNG·전투 수식 영향 없음, 캠프 전용 소모품 계약 유지, 유형 1의 UI preference만 폐기한다.
- 예정: React 렌더 경계·불필요한 상태 중복·아이콘 접근성·keyboard focus·canonical visual 변경 범위를 독립 리뷰한다.

## Test evidence

- 예정: component/Vitest에서 단일 전술 분기, 6개 자산 ID, 슬롯 상태·exact-once, icon tooltip/popover/Escape/focus return을 고정한다.
- 예정: Playwright에서 360/1024/1440, keyboard, 200%, reduced motion, 캠프 왕복과 실제 utility 동작을 검증한다.
- 예정: `npm run verify`와 GitHub push/PR quality 및 visual gate 증거를 기록한다.
