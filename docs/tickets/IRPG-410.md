# IRPG-410 — 보스 승리 보상·패배 결과 화면

## Outcome

보스 승리 시 이미 획득한 보상을 명확히 확인하고, 패배 시 일러스트와 복귀 stage·유지된 최고 기록을 이해한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK
- Owner / Reviewer: Codex / independent engine, frontend, asset, and accessibility reviewers

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

## Approved UI and asset contract

- `GameController`가 비영속 `combatEventGeneration`을 노출하고 `bootstrap`·reset·import·writer/reader 재동기화처럼 combat event batch를 폐기할 때마다 증가시킨다. consumer는 generation이 바뀌면 `lastConsumedCoordinate`·queue·overflow·열린 snapshot을 먼저 폐기한 뒤 새 generation의 batch만 처리한다. reload는 hook remount로 같은 경계를 만든다.
- 한 generation 안에서는 `(BigInt(roundSequence), ordinal)` 오름차순으로 결과를 처리하고 마지막 좌표 이하를 무시한다. 런타임에서 좌표가 유효하지 않은 event는 결과 queue에 넣지 않는다.
- `bossVictory`만 승리 결과로 처리하고 일반 `kill`은 제외한다. `event.gold`·`event.xp`는 실제 wallet delta가 아니라 엔진이 정산한 기본 전투 보상 기준값으로 “정산 완료” 표시하며 현재 balance나 content table에서 재계산하지 않는다. `milestoneReward !== null`이면 승인된 snapshot의 `tableId`·실제 `appliedGold`를 우선 표시하고 `appliedGold !== configuredGold`일 때만 configured 값과 안전 정수 상한 적용을 함께 알린다. `null`이면 “추가 최초 승리 보상 없음 · 정산 완료”로 표시한다. 현재 보유 골드는 `event.snapshot.gold`를 사용한다.
- `nextStage > defeatedStage`이면 다음 stage를 표시한다. stage 300처럼 `nextStage === defeatedStage`이면 진행이 멈춘 것으로 오해하지 않도록 “최종 스테이지 300 유지”로 표시한다. 패배는 event의 `defeatedAtStage`·`returnStage`·`highestStage`만 표시한다.
- `result.boss-victory`와 `result.defeat`는 서로 다른 project-owned 1280×720 WebP, 300 KiB 이하, 중앙 55% focal safe area로 제작한다. 승리는 금빛 불씨와 쓰러진 보스 silhouette, 패배는 방어 자세로 무릎 꿇은 살아 있는 영웅과 사그라드는 불씨를 사용하고 텍스트·logo·watermark·gore를 넣지 않는다. manifest는 각 entry를 `ready`와 고유 `src`·`sha256`·generator·prompt record로 고정한다.
- result art는 상세 dialog가 열릴 때만 lazy load하며 초기 전투·nonmodal status에서는 요청하지 않는다. 실패 시 `fallback.result`와 승패 텍스트가 그대로 남아야 한다.
- canonical visual fixture는 `visual.result.boss-victory`(stage 10, milestone configured/applied 15, next stage 11)와 `visual.result.defeat`(stage 10 패배, return 9, highest 11) 두 개다. 각각 고정 시각·seed·state/event hash를 사용하고 360×800·1440×900 × default·reduced-motion 4 variants를 캡처해 Ubuntu baseline을 32개에서 40개로 늘린다. corrupt result WebP의 `fallback.result` 전환은 별도 Playwright 흐름으로 검증한다.
- queue는 같은 generation에서 용량 때문에 제거된 `bossVictory`·`defeat`만 overflow로 집계하며 일반 IRPG-106 event나 dialog open/close는 포함하지 않는다. 보이는 최근 결과 list와 최신 신규 결과 한 건만 읽는 `aria-live="polite"`·`aria-atomic="true"` announcement를 분리한다. 빈 상태와 read-only 상태에서도 region은 이해 가능한 문구를 유지하고 이미 받은 결과의 상세 보기는 로컬 표시 동작으로 사용할 수 있다.

## Acceptance criteria

- Given boss victory event일 때, when 결과 화면을 표시하면, then 이벤트의 이미 지급된 gold·XP와 다음 stage를 한 번 보여주고 어떤 engine 보상 명령도 호출하지 않는다.
- Given milestone snapshot이 null·부분 지급·0 지급이거나 stage 300 승리일 때, when 상세를 열면, then snapshot에 있는 값과 상한 여부·추가 보상 없음·최종 stage 유지를 구분해 표시하고 어떤 값을 재계산하지 않는다.
- Given defeat event일 때, when 결과 화면을 표시하면, then 패배 일러스트·복귀 stage·유지된 highestStage가 실제 상태와 일치한다.
- Given 같은 event rerender·foreground tick일 때, when UI가 갱신되면, then nonmodal status는 focus를 빼앗지 않고 결과는 중복 표시·중복 지급되지 않으며 전투는 계속된다.
- Given 결과가 연속 4개 이상 발생할 때, when queue를 갱신하면, then 최신 3개만 유지하고 제거한 가장 오래된 결과 수를 overflow로 집계하며 dialog를 자동으로 연속 표시하지 않는다.
- Given 같은 IRPG-106 batch가 rerender되거나 queue에서 제거된 event가 다시 전달될 때, when consumer가 처리하면, then bounded `lastConsumedCoordinate` 이하 event는 다시 enqueue하지 않는다.
- Given 상세 dialog가 열린 결과가 queue에서 제거될 때, when 새 결과가 도착하면, then 열린 immutable snapshot은 닫을 때까지 유지되고 focus 복원 대상이 사라졌으면 result region heading으로 복원한다.
- Given reset·import·writer/reader 재동기화로 event generation이 바뀔 때, when 새 generation의 좌표가 다시 0부터 시작하면, then 이전 queue·overflow·열린 snapshot을 폐기하고 새 결과를 누락 없이 한 번 처리한다.
- Given reload·오프라인 정산일 때, when 앱을 열면, then 과거 개별 result를 재생하지 않고 기존 offline summary만 표시한다.
- Given 키보드·스크린리더·reduced motion일 때, when 사용자가 status에서 상세 result dialog를 열고 닫으면, then 그때만 focus trap이 적용되고 Escape·focus 복원과 모션 감소가 동작한다.
- Given 결과가 없거나 result image가 손상됐거나 앱이 read-only일 때, when result region과 상세를 사용하면, then 빈 상태·승패 HTML 정보·`fallback.result`가 유지되고 전투·저장·다른 탐색을 막지 않는다.

## Design

결과 UI는 IRPG-106의 비영속 event consumer다. 엔진 상태 전이가 보상과 stage를 먼저 확정하고 UI는 그 snapshot과 IRPG-207의 이미 지급된 milestone 보상을 표시만 한다. 자동 표시는 `role=status` 성격의 nonmodal banner이며 focus를 이동하지 않는다. 사용자가 명시적으로 상세 보기를 선택할 때만 일러스트 dialog를 열어 focus trap·Escape·focus 복원을 적용한다.

consumer는 마지막 처리 `(roundSequence, ordinal)` 하나만 메모리에 보존해 그 이하 event를 무시하므로 queue에서 제거된 항목도 rerender로 다시 나타나지 않는다. queue는 최신 3개를 유지하고 네 번째부터 가장 오래된 항목을 버리며 overflow count를 늘린다. 열린 dialog는 queue와 분리한 immutable snapshot으로 pin해 닫을 때까지 강제 unmount하지 않는다. 닫을 때 원래 trigger가 DOM에 없으면 result region heading으로 focus를 복원한다. `combatEventGeneration` 변경이나 reload 때 cursor·queue·overflow·open snapshot을 모두 폐기하며 어느 상태에서도 simulation clock은 멈추지 않는다.

## Verification

- 2026-07-19 Ready gate에서 모든 선행 티켓의 Done 상태와 보상 지급 단일 주체, generation 경계·비영속 queue·event dedupe, 승리·milestone·stage 300 표시 의미, reload/offline 비재생, dialog 접근성, 고유 result asset·fallback·40개 canonical baseline 계약을 확인했다.
- 독립 React·접근성·자산 Review에서 reward non-mutation, queue bound·overflow, BigInt cursor, generation reset, 열린 snapshot pin, StrictMode, trigger eviction·dialog fallback focus, 360px·200%·reduced motion을 확인했고 활성 P0·P1·P2 결함은 0건이다.
- 승리·패배 art 2종은 1280×720 RGB WebP 118,498B·70,004B로 제작해 고유 SHA-256·prompt·project-owned 권리 record를 연결했고 validator가 ready·고유 src/hash·300KiB 상한을 강제한다.

## Test evidence

- 완료: 로컬 `npm run verify:code` — Vitest 32파일·243/243, 자산 validator 30/30, manifest 27 IDs, production build 통과.
- 완료: 신규 foreground·승리·패배·pinned·reload/offline·fallback/zoom Playwright 6/6, 접근성 2/2, production 자산 4/4 통과.
- 완료: 로컬 격리 경로에서 result fixture 2개 × 360×800·1440×900 × default·reduced-motion 8/8 렌더와 수동 화면 검수 통과.
- 완료: 로컬 전체 `npm run verify` — Vitest 32파일·243/243, 자산 validator 30/30, manifest 27 IDs, 일반 Playwright 35/35, production 자산 Playwright 4/4, production build 통과. canonical screenshot 비교는 계약대로 Ubuntu 전용이라 로컬에서 건너뛰었다.
- 완료: commit `05e78773058b45875b243c07f9283c1eba518d79`에서 GitHub push quality run `29659072476`와 PR quality run `29659074246`이 모두 성공했다. 각 `playwright-report` artifact는 `8433792566` (`sha256:361d36300999c0f8aa8e5e4c61d52f7eadf2f8d7dc53dbfbf3cc41090cf5176c`)·`8433791319` (`sha256:64b59d3c686d06b745884f8fffffe1332ba7f44cac4ed4f7be8bd897dd86ebe9`)다.
- 완료: Ubuntu visual-baseline run `29659072473`에서 canonical 40/40 비교와 같은 runner 3회 반복 120/120이 성공했다. artifact `8433802120`은 `sha256:4504712df4eab1f3ac86c419314c2c4ca6bc6725dd212a7d19a4fa26c7daab92`이며 2026-08-01까지 보존된다.
