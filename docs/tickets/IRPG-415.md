# IRPG-415 — 선택형 통합 전술 전장

## Outcome

사용자가 기존 `유형 1 · 원 뷰 대시보드`를 그대로 사용하거나, 같은 게임 진행과 명령을 공유하는 `유형 2 · 통합 전술 전장`을 선택해 캐릭터·적·동료·전투 연출·원정 선택을 하나의 전장 맥락에서 플레이한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK, QA-E2E
- Owner / Reviewer: Codex / independent review

## Scope

- 상단 헤더에 키보드와 포인터로 조작하는 `유형 1 · 대시보드` / `유형 2 · 전술 전장` 선택기를 추가한다.
- 유형 1은 기존 `.game-dashboard` DOM·35/40/25 데스크톱 geometry·모바일 문서 흐름과 기존 52개 시각 기준선을 보존한다.
- 유형 2는 한 개의 `.tactical-canvas` 안에 현재 지역 배경, 영웅·현재 적·불씨 여우 루미, HP/HUD, 현재 10단계 지도 strip, 최근 전투 연출을 레이어로 합성한다.
- 성장·최근 전투 로그·환생·저장 명령은 전장 옆 command dock에서 계속 접근할 수 있게 한다.
- 대기 중인 원정 이벤트는 전장을 dim 처리하는 비모달 overlay에서 최대 3개 카드와 카드당 저장된 선택지 2개를 표시하고 기존 선택 명령을 재사용한다.
- `skill → critical → companionAssist → outcome` 전투 이벤트를 표시 전용 scene으로 묶되 과거 batch 재생, 명령 호출, 중복 낭독이 없게 한다.
- 레이아웃 선호는 게임 저장과 분리된 UI preference로만 보존하며 누락·잘못된 값·storage 실패 시 유형 1로 복구한다.
- 현재 게임 화풍에 맞는 루미 초상 자산과 생성 근거를 manifest에 추가하고 유형 2에서만 lazy-load한다.
- 1440×900·1024×768·360×800·200% 확대와 모션 감소 상태를 지원한다.

## Non-scope

- 게임 엔진, 전투 수식, RNG, 보상, 환생 밸런스 변경
- GameState·A/B 슬롯·portable save schema 또는 revision 변경
- 새 스킬·적·동료·원정 정의와 서버·계정·PvP 기능
- WebGL/canvas API, 오디오, 새 UI 프레임워크 도입

## Dependencies

- IRPG-106, IRPG-107, IRPG-108, IRPG-403, IRPG-408, IRPG-409, IRPG-410, IRPG-411, IRPG-412, IRPG-413, IRPG-414, IRPG-506
- 기존 게임 자산 manifest·lazy fallback·전투 event stream·원정 exact-once·결과 dialog 계약

## Impacts

- Save schema / migration / revision: none
- Game engine / formulas / deterministic RNG: none
- Content config: companion 정의에 표시 전용 `assetId` 추가; 저장되는 companion ID는 변경 없음
- Browser storage: 별도 `emberwatch.ui.layout.v1` 문자열 preference만 추가
- Accessibility: 상호배타 선택기, 단일 활성 renderer, 비모달 overlay, 44px 조작, 모션 감소 검토 필요

## Acceptance criteria

- Given 새 세션 또는 누락·잘못된 layout preference일 때, when 화면을 열면, then 유형 1만 DOM에 있고 기존 35/40/25 geometry·명령·기존 시각 기준선이 변하지 않는다.
- Given 레이아웃 선택기일 때, when pointer 또는 Tab·Enter·Space·ArrowLeft/Right를 사용하면, then 선택 상태와 유일하게 mount된 renderer가 일치하고 reload 후 유효한 선택만 복원된다.
- Given 유형 1과 유형 2를 전환할 때, then stage·gold·HP·RNG·revision·notice·combat batch는 선택 자체로 바뀌지 않고 중복 `id`·live region·명령 호출이 생기지 않는다.
- Given 유형 1이 활성일 때, then 유형 2 전용 지역·동료 자산을 요청하지 않고 유형 2 선택 후 현재 보이는 자산만 lazy-load한다.
- Given 유형 2일 때, then 현재 지역이 배경 전체를 cover하고 영웅은 왼쪽, 적은 오른쪽, 영입된 동료는 영웅 곁에 표시되며 각 HP와 전투 상태가 같은 canvas 경계 안에서 읽힌다.
- Given 새 combat event batch일 때, then event-time snapshot을 사용하는 `skill → critical → companionAssist → outcome` 표시가 round 순서대로 한 번만 나타나고 레이아웃 왕복·reload·generation reset에서 과거 표시를 재생하지 않는다.
- Given 한 번에 많은 event가 들어올 때, then 표시 queue는 유한하게 유지되고 오래된 일반 타격을 축약하되 최신 승리·패배 신호를 보존하며 게임 명령·보상·저장에는 영향을 주지 않는다.
- Given pending 원정 이벤트가 0·1·3개일 때, then 각각 base canvas 또는 해당 수의 overlay 카드를 표시하고 각 카드의 저장된 선택 2개 중 하나를 빠르게 반복 입력해도 명령은 정확히 한 번 호출되며 성공 후 기존 focus 복원 계약을 유지한다.
- Given 1440×900 또는 1024×768일 때, then header·canvas·dock이 겹치지 않고 문서 가로·세로 overflow 없이 viewport 안에서 핵심 전투·성장·관리 조작에 접근한다.
- Given 360×800 또는 200% 확대일 때, then canvas 다음에 dock이 문서 흐름으로 쌓이고 가로 overflow가 없으며 모든 주요 조작은 최소 44px이다.
- Given `prefers-reduced-motion: reduce`일 때, then slide·shake·pulse·transform animation은 제거되고 같은 전투 정보는 정지 배지와 수치로 남는다.
- Given 읽기 전용 또는 저장 실패 상태일 때, then 게임 명령만 기존 계약대로 막히고 레이아웃 선택은 계속 동작하며 진행 차단·저장 손실·보상 복제가 없다.

## Design

첨부된 Unified Tactical Canvas 제안을 현재 Emberwatch 디자인 토큰과 자산으로 구현한다. 두 레이아웃은 동시에 mount하지 않는다. 전투 VFX는 `combatEventBatch`와 `combatEventGeneration`을 읽는 비영속 표시 계층이며 `aria-hidden`으로 두고, 접근 가능한 정보는 기존 전투 로그·결과 live region이 담당한다. 원정 overlay는 자동 focus 이동·trap이 없는 비모달 section이고 기존 `ExpeditionEventPanel`의 exact-once·focus 복원 로직을 재사용한다.

IRPG-506에 `visual.dashboard.tactical-canvas`와 `visual.events.tactical-overlay`를 추가한다. 각 fixture는 360×800·1440×900 × default·reduced 4개 variant를 가지며 canonical은 52개에서 60개, 같은 runner 3회 반복은 156개에서 180개가 된다. 기존 52개 PNG 수정 0개를 승인 조건으로 둔다.

## Verification

- 구현 전 제품·아키텍처·자산·저장·접근성 계약 검토: UI composition과 별도 preference만 변경하며 엔진·GameState·A/B 저장·보상은 무영향
- Review: passed — 독립 코드 리뷰에서 단일 active renderer, 단일 combat-result live region, `useCombatResults` 단일 consumer, Type 1 결과 DOM 보존을 확인했으며 잔여 P0/P1/P2 결함이 없다.
- Verify: passed — 레이아웃 왕복 전후 GameState·RNG·notice·combat batch·A/B raw 저장 hash가 같고, 별도 UI preference만 변경되며 보상·저장·엔진 명령에는 쓰기가 없다.
- Test: passed — 로컬 전체 게이트, 실제 Chromium 흐름, Ubuntu canonical 생성·3회 반복, reference/implementation 수동 비교를 완료했다.

## Test evidence

- `npm run verify`: ESLint·strict typecheck·production build, Vitest 40파일/317개, manifest validator 32개, 일반 Playwright 51개, production 자산 Playwright 5개가 통과했다. Windows에서는 canonical visual 비교를 설계대로 건너뛰었다.
- IRPG-415 브라우저 흐름 11개는 기본값·잘못된 preference 복구·키보드 전환·단일 renderer/live region·게임/A/B 저장 불변·1440×900·1024×768·360×800·200%·reduced motion·원정 exact-once·신규 VFX만 재생을 검증했다.
- Ubuntu [visual-baseline run 29696226574](https://github.com/happypod/games01/actions/runs/29696226574)는 canonical 60/60 생성과 같은 runner 3회 반복 180/180을 통과했다. artifact `8445142347`, digest `sha256:1ce9eb90f342e5c543e50736664912452f974ac6b7019a1226ceef9854c0cf62`를 보관했다.
- artifact와 체크인 기준선을 SHA-256으로 비교해 기존 Type 1 포함 52개는 변경 0·누락 0, 신규 Type 2 전술 전장/원정 overlay는 정확히 8개임을 확인했다.
- 1440×900·360×800의 default/reduced 8개 최종 PNG와 첨부 reference/implementation 결합 비교를 수동 검토했다. 잘림·가로 overflow·겹침·잘못된 반경·미로드 자산·P0/P1/P2 시각 결함이 없다.
