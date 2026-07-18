# IRPG-408 — 3지역 스테이지 맵

## Outcome

300스테이지가 3개 지역으로 보이며 사용자는 현재·완료·잠김 구간을 이해하고 열린 스테이지만 이동한다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: ART-2D, FE-GAME, ENG-DATA, UX-FEEDBACK
- Owner / Reviewer: unassigned / frontend and accessibility reviewers

## Scope

- stage 1~100, 101~200, 201~300의 데이터 기반 지역 3개
- `region.ashen-border`·`region.moonfall-pass`·`region.forgotten-caldera` 배경/map plate와 fallback
- 현재·최고·완료·잠김·boss node 상태
- 기존 `selectStage` 명령을 쓰는 키보드·터치 탐색
- 지역 tab·landmark와 지역별 node roving tabindex
- 현재 위치 자동 focus가 아닌 명시적 이동/스크롤 제어

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
- Content config: three region definitions and stage ranges
- Accessibility: keyboard, landmarks, current/locked names required

## Acceptance criteria

- Given stage·highestStage일 때, when 맵을 렌더링하면, then 지역·현재·완료·잠김·10단위 boss node 상태가 파생되어 표시된다.
- Given 각 지역일 때, when 해당 stage 범위를 표시하면, then 올바른 지역 일러스트·이름·범위가 나타나며 이미지 실패 시 색·텍스트 map fallback으로 전환된다.
- Given 열린 node일 때, when click·Enter로 선택하면, then 기존 `selectStage`가 실행되고 잠긴 node는 명령을 호출하지 않는다.
- Given 360px·200% 확대·키보드·스크린리더일 때, when 세 지역을 탐색하면, then 가로 overflow·focus 손실 없이 현재 위치와 잠금 이유를 이해한다.
- Given 키보드로 맵에 진입할 때, when Arrow·Home·End·PageUp·PageDown을 누르면, then 한 node만 `tabindex=0`인 채 이전·다음·지역 처음·지역 끝·이전 지역·다음 지역으로 이동하고 300개 node가 순차 Tab stop이 되지 않는다.
- Given 잠긴 node에 focus할 때, when 접근 가능한 이름과 설명을 읽으면, then stage 번호·잠김 상태·필요한 `highestStage`가 함께 안내되고 Enter는 `selectStage`를 호출하지 않는다.
- Given reload·import일 때, when 맵을 다시 열면, then 별도 좌표 저장 없이 최신 stage 상태에서 같은 표시를 만든다.

## Design

지도는 `stage`와 `highestStage`의 파생 view다. 지역 tab은 Left/Right로 전환하고 현재 지역 landmark만 node 목록을 노출한다. node 안에서는 Left/Right 또는 Up/Down이 이전/다음, Home/End가 지역 처음/끝, PageUp/PageDown이 이전/다음 지역의 가까운 stage로 이동한다. 시각 node가 엔진 범위를 우회하지 않으며 region 정의만으로 3개 구간을 생성한다.

## Verification

- 1/10/100/101/200/201/300 경계와 키보드 읽기 순서를 Review한다.

## Test evidence

- 예정: region 경계 단위 테스트와 360px·키보드 Playwright 흐름
