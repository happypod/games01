# IRPG-411 — 전투 이벤트 로그 UI

## Outcome

최근 전투 이벤트가 제한된 로그로 보이되 자동 전투·focus·스크린리더를 방해하지 않는다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: FE-GAME, ENG-STATE, UX-FEEDBACK
- Owner / Reviewer: unassigned / frontend and accessibility reviewers

## Scope

- IRPG-106 최근 이벤트 최대 20개 로그
- event type filter, 시간 대신 round 순서, overflow 요약
- 접기·펼치기 keyboard 명령과 5초당 최대 1회의 polite screenreader summary

## Non-scope

- 서버 라이브 피드·채팅·푸시 알림
- UI 직접 보상, 원정 선택 카드, 무제한 로그 저장, 전투 중단 modal
- 퀘스트·업적·시즌 화면

## Dependencies

- IRPG-106 전투 이벤트 스트림
- IRPG-403 접근성 기준선
- IRPG-506 visual regression harness

## Impacts

- Save schema: none; 전투 로그는 비영속
- Content config: combat event presentation metadata
- Accessibility: announcement rate and focus order review required

## Acceptance criteria

- Given 연속 전투 이벤트일 때, when 로그를 표시하면, then 결정론적 순서의 최근 20개와 overflow 요약만 보여주고 렌더 비용이 누적되지 않는다.
- Given 초당 여러 이벤트일 때, when 스크린리더를 사용하면, then 새 이벤트를 type별 count로 합쳐 5초 window당 최대 한 번만 polite summary로 알리고 매 이벤트를 강제 낭독하지 않는다.
- Given reload·offline·알 수 없는 event type일 때, when UI를 복원하면, then 과거 전투 로그를 재생하지 않고 offline summary와 안전한 일반 텍스트 label을 유지한다.
- Given 승리·패배 result가 열릴 때, when 새 이벤트가 계속 발생하면, then bounded reducer만 갱신하고 result dedupe·전투 진행을 방해하지 않는다.

## Design

전투 로그는 IRPG-106 batch를 소비하는 메모리 ring buffer view이며 저장하지 않는다. live summary는 fake clock 기준 5초 trailing window에서 새 event를 type별로 합치고 window당 한 번만 발표한다. 로그를 수동 탐색하는 동작은 live region을 다시 발표하지 않는다. UI는 event를 표시만 하며 보상·전투 명령을 호출하지 않는다.

## Verification

- event 순서·20개 상한·보상 non-mutation·announcement 빈도를 Review한다.

## Test evidence

- 예정: ring buffer·5초 fake-clock announcement 컴포넌트 테스트와 keyboard/reload Playwright 흐름
