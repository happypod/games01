# IRPG-408 — 3지역 스테이지 맵

## Outcome

300스테이지가 3개 지역으로 보이며 사용자는 현재·완료·잠김 구간을 이해하고 열린 스테이지만 이동한다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Test
- Skill tags: ART-2D, FE-GAME, ENG-DATA, UX-FEEDBACK
- Owner / Reviewer: Codex implementation / independent frontend, accessibility, and art direction reviewers

## Scope

- stage 1~100, 101~200, 201~300의 데이터 기반 지역 3개
- `region.ashen-border`·`region.moonfall-pass`·`region.forgotten-caldera` 배경/map plate와 fallback
- 현재·최고·완료·잠김·boss node 상태
- 기존 `selectStage` 명령을 쓰는 키보드·터치 탐색
- 지역 tab·landmark와 지역별 node roving tabindex
- 현재 위치 자동 focus가 아닌 명시적 이동/스크롤 제어
- 기본 접힘 disclosure와 활성 지역만 mount하는 자산 lazy-load
- 1600×900 WebP 지역 일러스트 3장과 생성 prompt·권리 기록

## Non-scope

- 자유 이동 월드맵, 경로 탐색, 좌표 저장
- 신규 stage·보스 규칙, 에너지·입장권
- 서버 지도·멀티플레이어 위치

## Dependencies

- IRPG-103 stage 선택 계약
- IRPG-403 접근성 기준선
- IRPG-406 asset manifest
- IRPG-506 visual regression harness

## Impacts

- Save schema: none; map state is derived
- Content config: `재의 변경` 1~100·`월락 고개` 101~200·`잊힌 칼데라` 201~300의 이름·설명·landmark·asset ID
- Accessibility: keyboard, landmarks, current/locked names required
- Files: `src/game/stageMap.ts`, `src/components/StageMapPanel.tsx`, `src/components/GameScreen.tsx`, `src/styles.css`, 지역 자산·manifest·prompt 기록, domain/component/Playwright/visual regression tests

## Acceptance criteria

- Given stage·highestStage일 때, when 맵을 렌더링하면, then 지역·현재·완료·잠김·10단위 boss node 상태가 파생되어 표시된다.
- Given node 상태를 파생할 때, when `node < highestStage`면 완료, `node === highestStage`면 최전선, `node > highestStage`면 잠김이며 `node === currentStage`는 별도의 현재 표식이 된다. `highestStage === 300`에서도 저장된 301 milestone이 없으므로 300은 완료가 아니라 최전선이다.
- Given 각 지역일 때, when 해당 stage 범위를 표시하면, then 올바른 지역 일러스트·이름·범위가 나타나며 이미지 실패 시 색·텍스트 map fallback으로 전환된다.
- Given 열린 node일 때, when click·Enter·Space로 선택하면, then 기존 `selectStage`가 실행되고 잠긴 node는 focus 가능하되 `aria-disabled="true"`이며 명령을 호출하지 않는다.
- Given 게임이 초기화 전이거나 reader tab일 때, when 열린 node에 click·Enter·Space를 입력하면, then `controlsDisabled` 전역 사유를 접근 가능한 설명으로 제공하고 `selectStage`를 호출하지 않는다.
- Given 360px CSS viewport와 별도의 200% 확대에서 effective 360px layout·키보드·스크린리더일 때, when 세 지역을 탐색하면, then 가로 overflow·focus 손실 없이 현재 위치와 잠금 이유를 이해한다.
- Given 키보드로 맵에 진입할 때, when Arrow·Home·End·PageUp·PageDown을 누르면, then 한 node만 `tabindex=0`인 채 이전·다음·지역 처음·지역 끝·이전 지역·다음 지역으로 이동하고 300개 node가 순차 Tab stop이 되지 않는다.
- Given 잠긴 node에 focus할 때, when 접근 가능한 이름과 설명을 읽으면, then stage 번호·잠김 상태·필요한 `highestStage`가 함께 안내되고 Enter는 `selectStage`를 호출하지 않는다.
- Given reload·import일 때, when 맵을 다시 열면, then 별도 좌표 저장 없이 최신 stage 상태에서 같은 표시를 만든다.
- Given 첫 production route일 때, when 사용자가 맵 disclosure를 열지 않으면, then region namespace 요청은 0개이고 disclosure를 연 뒤 활성 지역 자산만 요청한다.
- Given 맵을 탐색하는 동안 자동 전투가 stage를 바꿀 때, when current marker가 갱신되면, then 사용자가 고른 지역 tab·roving focus·scroll 위치를 자동 변경하지 않는다.
- Given IRPG-506 registry일 때, when `visual.map.stage-frontier`의 debug fixture로 `stage=highestStage=105`를 적용하고 실제 `원정 지도 열기` disclosure 명령을 실행하면, then 지역 2가 활성화되고 roving node는 105이며 `.stage-map-panel`이 360×800·1440×900 × default·reduced motion 4개 canonical baseline과 일치한다. disclosure·tab·roving은 UI-local이라 GameState hash에는 넣지 않고 harness의 공개 UI 동작과 metadata로 검증한다.
- Given 최종 지역 자산일 때, when manifest를 검증하면, then 세 asset ID는 서로 다른 `src`와 SHA-256을 가진 1600×900 WebP·각 350 KiB 이하·`ready`이며 생성 prompt, author·license metadata를 갖는다. 독립 art review는 중앙 64%에 글자·문양·강한 명암 경계·주요 landmark가 없는지 확인한다.

## Design

지도는 `stage`와 `highestStage`의 파생 view이며 저장 필드를 추가하지 않는다. `재의 변경`은 불씨 감시탑, `월락 고개`는 월식 관문, `잊힌 칼데라`는 용의 화구를 시각 landmark로 삼는다. 완료와 잠김은 `highestStage`만으로 파생하고 현재 표식은 `stage`와 독립해 과거 완료 node에도 붙을 수 있다.

지도 disclosure는 기본 접힘이며 열릴 때 현재 stage가 속한 지역과 node를 최초 roving 대상으로 삼는다. 지역 tab은 Left/Right에서 끝을 순환하고 selection-follows-focus로 즉시 활성화하되 focus는 tab에 남는다. tab click도 활성 지역만 바꾸고 focus는 클릭한 tab에 남기며, 두 경우 모두 이전 roving node의 0~99 상대 offset을 새 지역에 보존한다. 현재 지역 landmark만 100개 node를 노출한다. node 안에서는 Left/Right 또는 Up/Down이 이전/다음으로 지역 경계에서 clamp하고, Home/End가 지역 처음/끝으로 이동한다. PageUp/PageDown은 이전/다음 지역의 같은 상대 offset node를 활성화하고 그 node로 focus를 옮기며 첫/마지막 지역에서는 no-op이다. 사용자 입력만 focus와 `scrollIntoView({ block: 'nearest' })`를 바꾸고 전투 state 갱신 effect는 두지 않는다. 잠긴 node와 전역 비활성 node는 native `disabled`를 쓰지 않아 이유를 읽을 수 있지만 click·Enter·Space는 막는다. 시각 node가 엔진 범위를 우회하지 않으며 region 정의만으로 3개 구간을 생성한다.

접힘 상태에서는 `StageMapPanel`과 `GameAsset` 자체를 mount하지 않는다. 열린 뒤에도 활성 tab의 region asset 하나만 mount해 IRPG-406 cold-load 예산을 지킨다. 일러스트는 텍스트·로고 없는 charcoal dark-fantasy landscape, 중앙 node overlay를 방해하지 않는 낮은 대비와 ember focal point를 사용하고 이름·범위·상태는 항상 HTML text로 제공한다.

## Verification

- `stageMap` domain review에서 1/10/100/101/200/201/300 경계, stage 300 frontier, 0~99 지역 offset과 인접 지역 clamp를 확인했다.
- 독립 frontend/accessibility review의 끊어진 `aria-controls`, 200% 확대 누락, 지역 hash 회귀 누락을 수정했다. 접힌 disclosure와 비활성 tab은 존재하지 않는 대상을 참조하지 않으며, 720px viewport의 200% 확대에서 세 지역 tab·PageDown focus·잠김 설명·가로 overflow를 검증한다.
- 저장 영향은 없다. 지도는 `stage`·`highestStage` 파생 view이고 UI-local disclosure·tab·roving 상태를 저장·portable backup·GameState hash에 추가하지 않았다.
- 독립 art review에서 P0/P1 없음으로 최종 승인했다. 세 자산은 중앙 64%의 주 landmark·강한 대비 침범이 없고 16:9 frame에서 의미 있는 crop 없이 기존 charcoal dark-fantasy 방향과 구분 가능한 silhouette를 유지한다.
- 지역 manifest는 `ready`, 고유 `src`, 실제 파일과 일치하는 고유 SHA-256, 1600×900 WebP, 350 KiB 이하를 validator가 강제한다. mutation fixture 자체도 모든 prompt record를 포함한 유효 상태인지 먼저 검증한다.

## Test evidence

- `npm run lint`, `npm run typecheck`, `npm run build`: 통과.
- `npm run test`: Vitest 23파일·153테스트 통과. 지도 domain·component·visual registry 집중 실행은 3파일·26테스트 통과.
- `npm run test:assets`: 정상 격리 fixture, 실제 SHA 비교, 지역 `ready`·고유 `src`·고유 SHA를 포함해 25/25 통과. `npm run assets:validate`는 27개 ID 통과.
- `npx playwright test e2e/stage-map.spec.ts`: 360px·200%·잠김 click/Enter/Space·tab/roving/Page 키·corrupt WebP fallback·자동 전투 focus 불변 6/6 통과.
- `CI=1 npm run test:e2e`: GitHub Actions와 같은 Chromium 1 worker 설정에서 기존 저장·전투·동료·접근성 회귀를 포함한 23/23 통과. 다중 탭 writer 2회 인계도 독립 반복 3/3을 추가 확인했다.
- `npm run test:e2e:assets`: production bundle에서 disclosure 전 region 요청 0, 연 뒤 활성 region 1개만 요청하는 cold-load를 포함해 3/3 통과.
- 로컬 비정식 `test:e2e:visual:update`: 최종 자산과 16:9 frame으로 5 fixture × 4 variant = 20/20 생성·육안 승인. Ubuntu canonical 20개 체크인과 최종 push/PR 품질 게이트는 진행 중이다.
