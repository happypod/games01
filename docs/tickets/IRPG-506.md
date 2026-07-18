# IRPG-506 — 시각 브라우저 회귀 게이트

## Outcome

기본 전투 시각 상태의 재현 가능한 screenshot harness를 먼저 만들고, 맵·카드·승패·이벤트 티켓이 같은 CI 게이트에 baseline을 확장한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Draft
- Skill tags: QA-E2E, REL-CI, ART-DIR
- Owner / Reviewer: unassigned / QA and art direction reviewers

## Scope

- 360×800·1440×900, default·reduced motion snapshot matrix
- 최초 baseline은 hero·enemy·boss의 기본 전투·fallback 상태
- 후속 티켓이 자기 region map·equipment/skill card·victory/defeat·event baseline을 같은 registry에 추가하는 계약
- named fixture ID·canonical state hash·고정 time/seed·UI-only setup과 Playwright screenshot comparison
- 실패 diff·actual·expected·trace의 CI artifact

## Non-scope

- 픽셀 동일성만으로 미술 승인 대체
- 도메인 함수·localStorage를 직접 호출하는 E2E setup
- IRPG-408~412가 구현되기 전 해당 화면의 가짜 baseline
- 모든 브라우저·GPU 조합의 완전 동일 rendering

## Dependencies

- IRPG-403 접근성 기준선
- IRPG-504 Playwright 전체 흐름
- IRPG-406 asset manifest
- IRPG-407 character and combat art
- IRPG-507 browser debug panel

## Impacts

- Save schema: none
- Content config: deterministic visual fixture IDs
- Accessibility: viewport and reduced-motion matrix retained

## Acceptance criteria

- Given 고정된 Ubuntu·Chromium·font·DPR·locale·color 환경일 때, when IRPG-507의 저장 격리 debug UI와 공개 명령으로 named 기본 전투 fixture에 도달하면, then registry의 canonical state hash가 일치하고 screenshot은 `threshold 0.15`, `maxDiffPixelRatio 0.001` 이하로 승인 baseline과 일치한다.
- Given 차이·page error·console error일 때, when CI가 실패하면, then expected·actual·diff·trace와 HTML report를 artifact로 보존한다.
- Given 360px·1440px·reduced motion일 때, when matrix를 실행하면, then 가로 overflow·가려진 명령·지속 모션 회귀도 함께 검출한다.
- Given baseline 갱신일 때, when Review하면, then 관련 티켓 ID와 미술·접근성 승인 이유가 변경 설명에 남는다.
- Given IRPG-408~412 중 하나를 구현할 때, when 그 티켓을 Test로 옮기면, then 소유 화면의 360×800·1440×900·reduced-motion baseline을 registry에 추가하고 동일 artifact 계약을 통과한다.

## Design

CI image는 floating `ubuntu-latest`가 아니라 `ubuntu-24.04`, Chromium revision은 lockfile의 `@playwright/test`, 글꼴은 저장소에 고정한 WOFF2를 사용한다. browser context는 DPR 1, `ko-KR`, `Asia/Seoul`, fixed clock `2026-01-01T00:00:00Z`, color scheme과 viewport를 variant에 명시한다. 비교 옵션은 channel당 `threshold: 0.15`, 전체 이미지 `maxDiffPixelRatio: 0.001`로 고정한다.

브라우저 context는 IRPG-507의 development/test 전용 저장 격리 debug UI·공개 게임 UI만 사용한다. production bundle에 debug panel을 포함하지 않으면서 CI의 test mode에서 동일 명령 adapter를 사용할 수 있어야 한다. 최초 named fixture는 `visual.combat.hero-default`, `visual.combat.enemy-default`, `visual.combat.boss-default`, `visual.combat.fallback`이며 registry entry는 소유 티켓 ID·canonical game-state hash·viewport·motion·color variant를 필수 metadata로 갖는다. hash가 다르면 screenshot 전에 실패한다. snapshot masking은 실제 비결정 영역에만 제한하며 전투 수치·카드 상태를 숨기지 않는다. 이 티켓은 harness와 기본 전투 baseline을 만들고 후속 UI 티켓은 자기 baseline을 같은 변경에서 확장한다.

## Verification

- fixture 재현성, pinned OS·Chromium·font·DPR, diff 한계, artifact retention과 승인 절차를 Review한다.

## Test evidence

- 예정: named fixture hash, local repeat 3회 안정성, pinned CI screenshot matrix와 expected·actual·diff artifact link
