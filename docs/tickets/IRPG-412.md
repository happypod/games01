# IRPG-412 — 원정 선택 이벤트 카드 UI

## Outcome

저장된 pending 원정 이벤트를 최대 3개 카드로 확인하고 keyboard·pointer로 선택해 효과를 정확히 한 번 적용한다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: ART-2D, FE-GAME, ENG-STATE, UX-FEEDBACK
- Owner / Reviewer: unassigned / frontend, save, and accessibility reviewers

## Scope

- IRPG-107 pending event 최대 3개의 일러스트 카드
- `event.ember-shrine`·`event.wandering-smith`·`event.ash-camp` 자산과 card fallback
- 선택지 효과 preview, 성공·실패·이미 완료 상태
- keyboard·pointer 명령과 focus 유지
- 이미지·metadata fallback

## Non-scope

- 전투 로그, 서버 라이브 이벤트, 퀘스트·시즌
- UI 직접 보상·재계산, 강제 modal·전투 정지
- pending event 생성·migration 규칙

## Dependencies

- IRPG-107 결정론적 원정 선택 이벤트
- IRPG-403 접근성 기준선
- IRPG-406 asset manifest
- IRPG-409 card language
- IRPG-506 visual regression harness

## Impacts

- Save schema: none beyond IRPG-107
- Content config: expedition event presentation metadata
- Accessibility: choice group, focus, status announcement review required

## Acceptance criteria

- Given pending event 0~3개일 때, when UI를 렌더링하면, then event ID·이미지·선택지·효과 preview와 빈 상태가 저장 상태와 일치한다.
- Given 선택 가능한 카드일 때, when keyboard·pointer로 선택하면, then IRPG-107 명령을 한 번 호출하고 성공·실패 이유를 표시한다.
- Given double click·rerender·reload일 때, when 같은 event를 다시 선택하면, then 완료된 ID는 재지급되지 않고 카드가 최신 pending 상태로 갱신된다.
- Given 선택 성공으로 현재 카드가 제거될 때, when focus를 복원하면, then 다음 pending 카드의 첫 선택지로 이동하고 pending이 없으면 원정 이벤트 section heading 또는 focus 가능한 empty state로 이동한다; 실패하면 누른 선택지에 focus를 유지한다.
- Given 이미지 실패·360px·200% 확대·스크린리더일 때, when 카드를 순회하면, then 텍스트 fallback·선택 관계·focus 순서가 유지되고 전투는 계속된다.

## Design

카드는 저장 상태의 view이며 효과를 계산하거나 지급하지 않는다. 선택 성공 뒤 engine이 반환한 새 상태를 표시하고 focus는 다음 pending 카드의 첫 선택지, 없으면 section heading/empty state로 보낸다. 거부된 명령은 원래 선택지에 focus를 유지하고 이유를 연결한다. 대기 중에도 자동 전투 tick을 막지 않는다.

## Verification

- 명령 1회 호출, idempotency 표시, pending 3개 상한, keyboard choice semantics를 Review한다.

## Test evidence

- 예정: 선택 command·성공/실패 focus 컴포넌트 테스트와 double-click/reload Playwright 흐름
