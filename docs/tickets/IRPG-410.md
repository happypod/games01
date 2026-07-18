# IRPG-410 — 보스 승리 보상·패배 결과 화면

## Outcome

보스 승리 시 이미 획득한 보상을 명확히 확인하고, 패배 시 일러스트와 복귀 stage·유지된 최고 기록을 이해한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Draft
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK
- Owner / Reviewer: unassigned / engine, frontend, and accessibility reviewers

## Scope

- 보스 승리 result art와 지급 완료 gold·XP·stage 요약
- 패배 일러스트, 복귀 stage, 최고 기록 유지 안내
- event당 한 번 표시하는 nonmodal status와 사용자가 여는 상세 dialog
- 최근 결과 queue 3개·overflow 요약, 닫기·focus 복원·reduced motion
- 오프라인 결과와 foreground 결과의 분리

## Non-scope

- UI에서 보상 지급·재계산, 추가 랜덤 보상
- revive 광고·결제, 패배 페널티 변경
- reload 뒤 과거 결과 재생, 오프라인 개별 승패 연속 재생

## Dependencies

- IRPG-106 결정론적 전투 이벤트
- IRPG-207 보스 최초 승리 보상 계약
- IRPG-403 접근성 기준선
- IRPG-406 asset manifest
- IRPG-413 enemy and boss art
- IRPG-506 visual regression harness

## Impacts

- Save schema: none; result queue is not persisted
- Content config: victory/defeat result asset IDs
- Accessibility: dialog focus, close, live announcement review required

## Acceptance criteria

- Given boss victory event일 때, when 결과 화면을 표시하면, then 이벤트의 이미 지급된 gold·XP와 다음 stage를 한 번 보여주고 어떤 engine 보상 명령도 호출하지 않는다.
- Given defeat event일 때, when 결과 화면을 표시하면, then 패배 일러스트·복귀 stage·유지된 highestStage가 실제 상태와 일치한다.
- Given 같은 event rerender·foreground tick일 때, when UI가 갱신되면, then nonmodal status는 focus를 빼앗지 않고 결과는 중복 표시·중복 지급되지 않으며 전투는 계속된다.
- Given 결과가 연속 4개 이상 발생할 때, when queue를 갱신하면, then 최신 3개만 유지하고 제거한 가장 오래된 결과 수를 overflow로 집계하며 dialog를 자동으로 연속 표시하지 않는다.
- Given 같은 IRPG-106 batch가 rerender되거나 queue에서 제거된 event가 다시 전달될 때, when consumer가 처리하면, then bounded `lastConsumedCoordinate` 이하 event는 다시 enqueue하지 않는다.
- Given 상세 dialog가 열린 결과가 queue에서 제거될 때, when 새 결과가 도착하면, then 열린 immutable snapshot은 닫을 때까지 유지되고 focus 복원 대상이 사라졌으면 result region heading으로 복원한다.
- Given reload·오프라인 정산일 때, when 앱을 열면, then 과거 개별 result를 재생하지 않고 기존 offline summary만 표시한다.
- Given 키보드·스크린리더·reduced motion일 때, when 사용자가 status에서 상세 result dialog를 열고 닫으면, then 그때만 focus trap이 적용되고 Escape·focus 복원과 모션 감소가 동작한다.

## Design

결과 UI는 IRPG-106의 비영속 event consumer다. 엔진 상태 전이가 보상과 stage를 먼저 확정하고 UI는 그 snapshot과 IRPG-207의 이미 지급된 milestone 보상을 표시만 한다. 자동 표시는 `role=status` 성격의 nonmodal banner이며 focus를 이동하지 않는다. 사용자가 명시적으로 상세 보기를 선택할 때만 일러스트 dialog를 열어 focus trap·Escape·focus 복원을 적용한다.

consumer는 마지막 처리 `(roundSequence, ordinal)` 하나만 메모리에 보존해 그 이하 event를 무시하므로 queue에서 제거된 항목도 rerender로 다시 나타나지 않는다. queue는 최신 3개를 유지하고 네 번째부터 가장 오래된 항목을 버리며 overflow count를 늘린다. 열린 dialog는 queue와 분리한 immutable snapshot으로 pin해 닫을 때까지 강제 unmount하지 않는다. 닫을 때 원래 trigger가 DOM에 없으면 result region heading으로 focus를 복원한다. cursor·queue·open snapshot은 reload 때 모두 폐기하며 어느 상태에서도 simulation clock은 멈추지 않는다.

## Verification

- 보상 지급 단일 주체, event dedupe, reload/offline 비재생, dialog 접근성을 Review한다.

## Test evidence

- 예정: reward non-mutation 컴포넌트 테스트와 boss victory/defeat Playwright 흐름
