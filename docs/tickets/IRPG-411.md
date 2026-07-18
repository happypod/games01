# IRPG-411 — 전투 이벤트 로그 UI

## Outcome

최근 전투 이벤트가 제한된 로그로 보이되 자동 전투·focus·스크린리더를 방해하지 않는다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Ready
- Skill tags: FE-GAME, ENG-STATE, UX-FEEDBACK
- Owner / Reviewer: Codex / independent engine, frontend, and accessibility reviewers

## Scope

- IRPG-106 최근 이벤트 중 마지막 20개를 표시하는 비영속 로그
- 치명타·화염 강타·동료 협공·일반 승리·보스 승리·패배 표시 metadata와 그룹 filter
- IRPG-106에 저장·RNG·보상을 바꾸지 않는 `companionAssist` 이벤트 snapshot 추가
- 시간 대신 canonical `roundSequence`, 20개 이전 overflow와 filter 숨김 수 요약
- 접기·펼치기 native keyboard 명령과 5초 window당 최대 1회의 polite screenreader summary
- `visual.combat.event-log` 360×800·1440×900 × default·reduced-motion canonical fixture

## Non-scope

- 서버 라이브 피드·채팅·푸시 알림
- UI 직접 보상, 원정 선택 카드, 무제한 로그 저장, 전투 중단 modal
- 퀘스트·업적·시즌 화면

## Dependencies

- IRPG-106 전투 이벤트 스트림
- IRPG-108 첫 동료 협공 전투
- IRPG-403 접근성 기준선
- IRPG-506 visual regression harness

## Impacts

- Save schema: none; 전투 로그는 비영속
- Content config: combat event presentation metadata; 전투 수식·보상 수치 변경 없음
- Accessibility: announcement rate and focus order review required

## Event and ordering contract

- engine event 순서는 `skill(10) → critical(20) → companionAssist(25) → outcome(30)`이다.
- `companionAssist`는 영웅 공격 뒤 적이 생존하고 준비된 동료가 실제 피해를 적용했을 때만 한 번 발생한다. payload는 `companionId`, 적용 피해량, stage와 즉시 snapshot을 포함하며 RNG draw를 추가하지 않는다.
- outcome은 일반 `kill`, `bossVictory`, `defeat` 중 하나이며 기존 공통 처치·보상 분기만 지급 주체다. 로그와 live region은 event를 표시만 한다.
- UI는 batch의 최근 20개를 먼저 고정한 뒤 filter를 적용한다. `totalEvents - min(totalEvents, 20)`은 이전 이벤트 요약 수이고, 현재 20개 중 filter로 숨긴 수는 별도로 표시한다.
- 알 수 없는 runtime type은 버리거나 throw하지 않고 `알 수 없는 전투 이벤트` 일반 label과 round·stage를 표시한다.

## UI state contract

- 기본은 접힘이며 heading·최근/누락 수·44px 이상 펼치기 button과 빈 live region만 노출한다.
- 펼치면 `모두·치명타·스킬·협공·승리·패배` checkbox filter와 최대 20개 ordered list를 표시한다. 빈 batch와 filter 결과 0건은 각각 명시적 empty text를 표시한다.
- toggle·filter·수동 탐색은 live region을 갱신하지 않는다. 새 batch만 발표 후보가 된다.
- 첫 새 이벤트가 들어오면 timer 하나로 5초 동안 type별 count를 합치고 window 끝에 한 번만 `aria-live="polite"`로 발표한다. reset·reload·import·unmount는 pending timer와 count를 폐기한다.
- 로그의 접힘·filter·announcement 상태와 event ID는 `GameState`, A/B envelope, portable backup에 저장하지 않는다.

## Acceptance criteria

- Given 연속 전투 이벤트일 때, when 로그를 표시하면, then 결정론적 순서의 최근 20개와 overflow 요약만 보여주고 렌더 비용이 누적되지 않는다.
- Given 영웅 뒤 준비된 동료가 공격할 때, when 전투 라운드를 처리하면, then `companionAssist(25)`가 적용 피해 snapshot으로 정확히 한 번 발생하고 RNG state·draw 수·보상·최종 GameState는 기존 협공 계산과 동일하다.
- Given 초당 여러 이벤트일 때, when 스크린리더를 사용하면, then 새 이벤트를 type별 count로 합쳐 5초 window당 최대 한 번만 polite summary로 알리고 매 이벤트를 강제 낭독하지 않는다.
- Given reload·offline·알 수 없는 event type일 때, when UI를 복원하면, then 과거 전투 로그를 재생하지 않고 offline summary와 안전한 일반 텍스트 label을 유지한다.
- Given `bossVictory`·`defeat` 이벤트일 때, when 로그가 소비하면, then 확정 snapshot을 일반 텍스트로만 표시하고 보상·전투 명령이나 향후 IRPG-410 result dedupe를 호출하지 않는다.
- Given 접힘·펼침과 filter를 키보드로 조작할 때, when Tab·Enter·Space를 사용하면, then focus 순서가 DOM 순서와 같고 자동 전투 update가 focus·scroll을 옮기지 않는다.
- Given 360px·200% 확대·reduced motion일 때, when 20개 로그와 filter를 표시하면, then 가로 overflow·말줄임·44px 미만 명령·지속 motion이 없다.

## Design

전투 로그는 IRPG-106의 최대 100개 batch를 소비해 마지막 20개만 파생하는 bounded view이며 별도 event 사본을 누적하거나 저장하지 않는다. presentation selector는 type을 category·label·tone으로 변환하고 알 수 없는 type에도 total function으로 동작한다. live summary hook은 fake clock 기준 첫 새 event부터 5초 window 동안 count와 마지막 round만 ref에 모으고 timer 하나만 유지한다. 로그를 수동 탐색하는 동작은 live region을 다시 발표하지 않는다. UI는 event를 표시만 하며 보상·전투 명령을 호출하지 않는다.

visual fixture는 debug 저장 격리 UI의 공개 fixture 적용 명령으로 고정 GameState와 비영속 6종 event batch를 함께 주입한다. GameState canonical hash에는 event·접힘 상태를 넣지 않고 harness가 실제 `전투 로그 펼치기` button을 눌러 `.combat-log-panel`을 캡처한다. 기존 28개 canonical은 byte-identical이어야 하며 새 4개를 더해 32개가 된다.

## Verification

- event 순서·20개 상한·보상 non-mutation·announcement 빈도, timer cleanup, focus 불변을 Review한다.

## Test evidence

- 예정: selector·engine event·5초 fake-clock announcement 컴포넌트 테스트, keyboard/reload/offline Playwright, 32개 Ubuntu canonical visual 흐름
