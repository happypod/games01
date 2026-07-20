# IRPG-422 — 전술 전장 단일화·전투 슬롯바·유틸리티 도크

## Outcome

사용자가 하나의 전술 전장 화면에서 장비·스킬·보급품을 빠르게 확인하고 실행하며, 보조 기능은 간결한 아이콘 도크에서 필요할 때만 열어 사용한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Test
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

우측 보조 기능은 `TacticalUtilityDock`의 네 icon button과 하나의 non-modal popover로 합친다. tooltip은 hover/focus에, 상세와 실행 버튼은 click에만 보인다. popover는 한 번에 하나만 열고 Escape·명시적 닫기·active trigger에서 원래 trigger로 포커스를 되돌리며, 외부 클릭에서는 사용자가 선택한 외부 대상의 포커스를 보존한다. 기존 로그·결과·환생·백업 컴포넌트는 compact surface 안에서 재사용해 저장과 보상 명령의 단일 진입점을 보존한다.

## Verification

- 구현 전 검토: 저장·RNG·전투 수식 영향 없음, 캠프 전용 소모품 계약 유지, 유형 1의 UI preference만 폐기한다.
- 코드 리뷰: `GameScreen`은 `currentMode`만으로 단일 전술 전장과 캠프를 분기하고, 액션바·도크의 disclosure 상태는 컴포넌트 로컬에만 둔다. 게임 엔진·상태 타입·저장 encoder/decoder·RNG·밸런스 수식은 변경하지 않는다.
- 자산 리뷰: 액션바 1~6번은 `equipment.ember-blade`, `equipment.guard-armor`, `equipment.fortune-charm`, `skill.power-strike`, `skill.iron-will`, `skill.loot-sense`를 실제 manifest resolver로 매핑하고, 7~8번 소모품은 별도 이미지 요청이 없는 아이콘으로 표시한다.
- 접근성 리뷰: 8슬롯과 4아이콘에 accessible name과 44px target을 제공하고, tooltip과 실행 popover를 분리하며 한 popover만 열리게 한다. 상세 진입 시 heading focus, Escape·명시적 닫기 뒤 trigger focus 복귀, 외부 클릭 대상 focus 보존, 중첩 modal Escape 소유권, 읽기 순서와 reduced-motion 정적 대체를 확인한다.
- 호환성 리뷰: 과거 `emberwatch.ui.layout.v1` 값은 무시하지만 삭제를 위해 저장 게임을 다시 쓰지 않으며, A/B slot·portable backup의 schema·revision·canonical hash가 그대로 유지되는지 검증한다.
- 회귀 리뷰: IRPG-414~417의 유형 1·2 비교는 과거 완료 증거로 보존하고, IRPG-422부터 단일 전술 화면 baseline이 해당 화면 수용 기준을 대체한다.

## Test evidence

- Component/Vitest 계획: 단일 전술 분기와 stale layout preference 무시, 8슬롯 순서·6개 자산 ID·2개 소모품 아이콘, available/locked/insufficient/max/disabled 상태, 강화·각인 exact-once, 캠프 이동, icon tooltip·단일 popover·Escape·외부 클릭·focus return을 고정한다.
- Playwright 계획: 360×800·1024×768·1440×900, keyboard, effective 360px/200%, reduced motion, 페이지 가로 overflow·44px target, 캠프 왕복, 전투 로그·승패 결과·환생·저장 내보내기/가져오기의 실제 동작을 검증한다.
- Production asset 계획: 초기 화면에서 현재 영웅·적과 액션바 6개 실제 자산을 확인하고, 소모품 이미지와 비활성 지역·이벤트·damage/result 자산은 disclosure 전 요청하지 않는지 검증한다.
- Visual 계획: 기존 18개 fixture·72개 variant 이름과 수를 유지하면서 전투 fixture만 단일 전술 화면으로 재승인하고, 전투 로그는 실제 스크롤 popover surface를 캡처하며 캠프 fixture·저장 canonical의 비의도 변경이 없는지 비교한다.
- Review 완료 (2026-07-20): 단일 `currentMode` 분기, 8슬롯 명령 재사용, 4아이콘 disclosure, 저장·RNG·보상 불변 범위를 독립 React/E2E 감사로 확인했다. 감사에서 발견한 슬롯 heading focus, 명시적 닫기 focus return, 외부 클릭 focus 보존, 중첩 modal Escape 소유권과 백업 availability reset을 구현·회귀 테스트로 보강했다.
- Verify 완료 (2026-07-20, local): `IRPG_FORCE_VISUAL_COMPARE=1 npm run verify` 성공. ESLint·TypeScript·production build 통과, Vitest `46 files / 399 tests`, manifest `33 tests`, manifest validator `30 IDs`가 모두 통과했다. build 결과는 CSS `68.86 kB`와 App JS `266.99 kB`였다.
- Test 완료 (2026-07-20, local): 일반 Playwright `60/60`, production asset Playwright `5/5`, canonical visual comparison `18 fixtures × 4 variants = 72/72`가 통과했다. 1440px·360px one-view, 8슬롯 자산, 전투 로그 popover를 육안 검수해 가로 overflow·잘림·겹침이 없음을 확인했다.
- GitHub 증거 대기: branch push 뒤 PR quality와 Ubuntu visual run/artifact를 확인하고 링크를 기록한 다음에만 Done으로 전환한다.
