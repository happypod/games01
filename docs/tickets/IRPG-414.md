# IRPG-414 — 데스크톱 원 뷰 대시보드

## Outcome

1024px 이상에서는 전투·원정·로그·성장을 문서 스크롤 없이 한 화면에서 조작하고, 360px에서는 기존 세로 흐름을 유지한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Ready
- Skill tags: FE-GAME, UX-FEEDBACK, QA-E2E
- Owner / Reviewer: Codex / independent review

## Scope

- 1024px 이상에서 `100dvh` 앱 shell과 고정 헤더 아래 35% / 40% / 25% 3열 Grid를 사용한다.
- 좌측은 `BattleArena`와 `HeroPanel`, 중앙은 압축 지도·원정 이벤트·승패 결과와 최근 전투 로그, 우측은 장비·스킬·동료 성장 탭과 환생·저장 관리를 표시한다.
- 현재 10개 스테이지 구간은 지도를 열기 전에도 압축 타임라인으로 표시하고, 전체 지도는 기존 disclosure로 연다.
- 최근 전투 이벤트 최대 5개를 접힌 로그에서도 표시한다.
- 각 열과 긴 pane은 `min-height: 0`과 독립 스크롤을 사용한다.
- 1024px 미만에서는 기존 landmark·heading DOM 순서의 세로 문서 흐름과 모든 성장 패널 표시를 유지한다.
- 기존 Emberwatch 색상·타입·패널·일러스트·focus 표현을 재사용한다.

## Non-scope

- 게임 엔진, 밸런스, RNG, 보상, 저장 형식 변경
- Tailwind CSS 또는 새 UI 프레임워크 도입
- 새 게임 콘텐츠·자산·라우트 추가
- 서버·클라우드·계정 기능

## Dependencies

- IRPG-401, IRPG-403, IRPG-407, IRPG-408, IRPG-409, IRPG-410, IRPG-411, IRPG-412, IRPG-506
- 기존 360×800·1440×900 fixture와 프로덕션 자산 lazy-load 계약

## Impacts

- Save schema: none
- Content config: none
- Accessibility: tablist·roving focus·내부 스크롤·반응형 DOM 표시 검토 필요

## Acceptance criteria

- Given 1440×900 또는 1024×768 viewport일 때, when 초기 화면을 표시하면, then 문서의 `scrollWidth <= clientWidth`, `scrollHeight <= clientHeight`, `window.scrollY = 0`이고 헤더와 3개 열이 겹치거나 잘리지 않는다.
- Given 초기 데스크톱 화면일 때, then 전투 상태·현재 적, 현재 10단계 지도, 최근 로그, 성장 tablist·첫 실행 가능 강화, 환생·백업 조작을 viewport 안에서 찾을 수 있다.
- Given 긴 지도·이벤트·성장 콘텐츠일 때, when 키보드로 마지막 조작까지 이동하면, then 해당 내부 pane만 스크롤되고 focus가 가려지지 않는다.
- Given 성장 tablist일 때, when pointer 또는 ArrowLeft/Right·Home·End를 사용하면, then `aria-selected`, roving `tabIndex`, 보이는 panel이 일치하고 게임 tick·rerender가 선택을 바꾸지 않는다.
- Given 비활성 성장 panel일 때, then 해당 카드 자산은 활성화 전 요청되지 않으며 활성화 후 해당 namespace만 로드된다.
- Given pending 원정 이벤트 또는 승패 결과일 때, then 중앙 pane에서 개수·상태를 확인할 수 있고 자동 전환이나 focus 탈취가 없다.
- Given 360×800 또는 200% 확대의 effective 360px일 때, then 기존 세로 landmark 순서·44px 조작·문서 세로 스크롤을 유지하고 가로 overflow가 없다.
- Given 기존 구매·스테이지·원정·환생·저장 명령일 때, when 대시보드와 탭을 반복 조작하면, then 허용된 명령만 정확히 한 번 실행되고 GameState·revision·RNG 계약은 변하지 않는다.

## Design

게임 상태는 추가하지 않는다. 성장 탭의 활성 ID와 각 disclosure·내부 스크롤 위치는 UI-local이며 저장하지 않고 reload 시 기본 장비 탭으로 돌아간다. 데스크톱은 실제 DOM 열 순서와 시각 순서를 일치시키고, 모바일에서는 탭 chrome만 감춘 채 장비·스킬·동료 세 section을 모두 표시한다. 모달·오프라인 보고는 고정 backdrop 계약을 유지한다.

IRPG-506에 `visual.dashboard.one-view`의 360×800·1440×900 × default·reduced 4개 variant를 추가한다. canonical은 48개에서 52개, 같은 runner 3회 반복은 144개에서 156개가 된다.

## Verification

- 구현 전 제품·아키텍처·접근성·저장 계약 검토: 게임/저장 무영향, React 조합과 CSS layout만 변경
- Review → Verify → Test 순서로 기록

## Test evidence

- 예정: GrowthTabs·GameScreen·StageMapPanel·CombatLogPanel Vitest
- 예정: 1440×900·1024×768·360×800·200% 확대 Playwright
- 예정: inactive 성장 자산 lazy-load와 기존 fallback 회귀
- 예정: IRPG-506 Ubuntu 52/52와 3회 반복 156/156
- 예정: `npm run verify`
