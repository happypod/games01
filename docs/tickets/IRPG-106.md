# IRPG-106 — 결정론적 전투 이벤트 스트림

## Outcome

치명타·스킬 시전·처치·보스 승리·플레이어 패배를 UI가 재현 가능한 순서와 수치로 소비한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Ready
- Skill tags: ENG-STATE, ENG-SIM, QA-DOMAIN
- Owner / Reviewer: Codex / independent engine reviewer

## Scope

- `advanceGame` 결과의 비영속 `events`와 overflow 집계
- 치명타, 화염 강타, 일반 처치, 보스 승리, 플레이어 패배 이벤트
- event type·stream round sequence·고정 ordinal·안정 event ID·stage·이벤트 발생 시점 snapshot 계약
- `bossVictory { defeatedStage, nextStage, gold, xp }`와 `defeat { defeatedAtStage, returnStage, highestStage }` payload
- 호출당 최근 100개와 총 event 수, 단일·분할 batch를 합치는 bounded reducer

## Non-scope

- UI·애니메이션·사운드, 새 보상·전투 수식
- 원정 선택 이벤트, 이벤트 저장·reload 재생

## Dependencies

- IRPG-103 패배·스테이지
- IRPG-104 저장 RNG·치명타
- IRPG-505 장시간 결정론 기준선

## Impacts

- Save schema: none; 이벤트는 저장하지 않음
- Content config: event type contract added
- Accessibility: 후속 UI에서 검토

## Acceptance criteria

- Given 같은 상태·seed·비영속 start cursor·총 시간일 때, when 단일 batch와 분할 batch를 `mergeCombatEventBatches`로 합치면, then next cursor·총 event 수·최근 100개의 ID/type/순서/stage/수치와 최종 상태가 같다.
- Given 치명타·화염 강타·처치·보스 승리·패배 분기일 때, when 한 라운드를 처리하면, then 각 이벤트는 확정된 피해·보상·복귀 결과를 한 번만 포함한다.
- Given 같은 라운드의 여러 이벤트일 때, when event ID를 만들면, then `roundSequence + draw 뒤 RNG state + 고정 ordinal/type`으로 같은 start cursor의 단일·분할 실행과 rerender에서 안정적이다.
- Given 이벤트 뒤에 같은 batch에서 stage·highestStage·재화가 다시 변할 때, when payload를 읽으면, then `bossVictory`와 `defeat` 값은 나중 상태가 아니라 해당 이벤트 발생 직후의 snapshot이다.
- Given 100개를 넘는 단일·분할 batch일 때, when reducer를 적용하면, then 최근 100개만 보존하고 `totalEvents - events.length` 누락 수와 기존 `AdvanceReport` 총합은 정확하다.
- Given reload·오프라인 bootstrap일 때, when 이벤트를 소비하면, then 저장에 이벤트를 쓰거나 과거 결과 화면을 재생하지 않고 오프라인은 합계 보고를 유지한다.
- Given RNG draw count와 event cursor가 `Number.MAX_SAFE_INTEGER` 경계를 넘을 때, when 단일·분할 batch를 실행하면, then decimal cursor는 포화·충돌하지 않고 event ID와 `(roundSequence, ordinal)` 순서가 유일하게 유지된다.

## Design

이벤트는 각 엔진 상태 전이가 확정되는 시점에 snapshot을 잡는 읽기 전용 `CombatEventBatch { nextCursor, totalEvents, events }`다. 호출자는 저장하지 않는 `CombatEventCursor`를 canonical non-negative decimal string으로 전달하며 엔진은 event 유무와 관계없이 combat round마다 BigInt로 1을 더한다. 브라우저 생명주기는 이 cursor를 메모리에 보유하고 reload 때 queue와 함께 `"0"`으로 초기화하므로 과거 결과를 재생하지 않는다. RNG `draws`가 포화되어도 cursor는 독립적으로 증가한다.

`mergeCombatEventBatches`는 total을 더하고 event ID는 중복 제거에만 사용한다. 정렬과 절단은 문자열 ID가 아니라 decimal `roundSequence`의 수치 비교와 `ordinal` 오름차순을 보존해 최근 100개를 유지하며, 같은 좌표의 서로 다른 ID는 계약 오류로 실패시킨다. 보상 지급 주체는 기존 처치 분기 하나뿐이며 UI는 이벤트를 근거로 다시 지급하지 않는다. 동일 round에서 발생한 이벤트는 `skill → critical → kill/bossVictory 또는 defeat`의 고정 ordinal을 따른다.

## Verification

- event 순서·buffer 상한·summary 일치·분할 실행 결정론을 독립 리뷰한다.

## Test evidence

- 예정: engine event 단위·장시간 overflow·MAX_SAFE cursor 교차 회귀와 전체 `npm run verify`
