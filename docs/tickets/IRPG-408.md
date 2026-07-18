# IRPG-408 — 3지역 스테이지 맵

## Outcome

300스테이지가 3개 지역으로 보이며 사용자는 현재·완료·잠김 구간을 이해하고 열린 스테이지만 이동한다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Ready
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
- Given 360px·200% 확대·키보드·스크린리더일 때, when 세 지역을 탐색하면, then 가로 overflow·focus 손실 없이 현재 위치와 잠금 이유를 이해한다.
- Given 키보드로 맵에 진입할 때, when Arrow·Home·End·PageUp·PageDown을 누르면, then 한 node만 `tabindex=0`인 채 이전·다음·지역 처음·지역 끝·이전 지역·다음 지역으로 이동하고 300개 node가 순차 Tab stop이 되지 않는다.
- Given 잠긴 node에 focus할 때, when 접근 가능한 이름과 설명을 읽으면, then stage 번호·잠김 상태·필요한 `highestStage`가 함께 안내되고 Enter는 `selectStage`를 호출하지 않는다.
- Given reload·import일 때, when 맵을 다시 열면, then 별도 좌표 저장 없이 최신 stage 상태에서 같은 표시를 만든다.
- Given 첫 production route일 때, when 사용자가 맵 disclosure를 열지 않으면, then region namespace 요청은 0개이고 disclosure를 연 뒤 활성 지역 자산만 요청한다.
- Given 맵을 탐색하는 동안 자동 전투가 stage를 바꿀 때, when current marker가 갱신되면, then 사용자가 고른 지역 tab·roving focus·scroll 위치를 자동 변경하지 않는다.
- Given IRPG-506 registry일 때, when `visual.map.stage-frontier`를 실행하면, then stage 105의 두 번째 지역 화면이 360×800·1440×900 × default·reduced motion 4개 canonical baseline과 일치한다.
- Given 최종 지역 자산일 때, when manifest를 검증하면, then 세 파일은 서로 다른 1600×900 WebP·각 350 KiB 이하·`ready`이며 중앙 UI 안전영역, 생성 prompt, author·license metadata를 갖는다.

## Design

지도는 `stage`와 `highestStage`의 파생 view이며 저장 필드를 추가하지 않는다. `재의 변경`은 불씨 감시탑, `월락 고개`는 월식 관문, `잊힌 칼데라`는 용의 화구를 시각 landmark로 삼는다. 완료와 잠김은 `highestStage`만으로 파생하고 현재 표식은 `stage`와 독립해 과거 완료 node에도 붙을 수 있다.

지도 disclosure는 기본 접힘이며 열릴 때 현재 stage가 속한 지역과 node를 최초 roving 대상으로 삼는다. 지역 tab은 Left/Right로 전환하고 현재 지역 landmark만 100개 node를 노출한다. node 안에서는 Left/Right 또는 Up/Down이 이전/다음, Home/End가 지역 처음/끝, PageUp/PageDown이 이전/다음 지역의 같은 상대 offset으로 이동한다. tab 클릭과 PageUp/PageDown도 상대 offset을 보존한다. 사용자 입력만 focus와 `scrollIntoView({ block: 'nearest' })`를 바꾸고 전투 state 갱신 effect는 두지 않는다. 잠긴 node는 native `disabled`를 쓰지 않아 이유를 읽을 수 있지만 click·Enter·Space는 막는다. 시각 node가 엔진 범위를 우회하지 않으며 region 정의만으로 3개 구간을 생성한다.

접힘 상태에서는 `StageMapPanel`과 `GameAsset` 자체를 mount하지 않는다. 열린 뒤에도 활성 tab의 region asset 하나만 mount해 IRPG-406 cold-load 예산을 지킨다. 일러스트는 텍스트·로고 없는 charcoal dark-fantasy landscape, 중앙 node overlay를 방해하지 않는 낮은 대비와 ember focal point를 사용하고 이름·범위·상태는 항상 HTML text로 제공한다.

## Verification

- 1/10/100/101/200/201/300 경계, stage 300 frontier, 키보드 읽기 순서, 잠김 명령 차단, state 변경 시 focus 불변, 초기 region 요청 0을 Review한다.

## Test evidence

- 예정: region 경계·파생 상태 단위 테스트, roving component test, 360px·200%·키보드·fallback·cold-load Playwright, IRPG-506 canonical 4개 baseline
