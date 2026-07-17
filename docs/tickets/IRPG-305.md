# IRPG-305 — 다중 탭 저장 충돌 방지

## Outcome

같은 저장을 연 여러 탭 중 한 탭만 진행을 기록하고, 나머지 탭은 최신 상태를 읽기 전용으로 표시해 진행 손실과 오프라인 보상 중복을 막는다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Done
- Skill tags: ENG-SAVE, FE-GAME, QA-E2E
- Owner / Reviewer: Codex / architecture audit

## Scope

- Chromium·Edge의 Web Locks API로 origin 단위 writer를 bootstrap 전에 선출
- writer만 오프라인 정산, 전투 tick, 명령, 자동 저장, 초기화를 수행
- 모든 쓰기에 기대 revision을 전달하고 오래된 revision이면 원문을 바꾸지 않고 거부
- reader는 `storage` 이벤트로 최신 검증 저장을 반영하고 writer 종료 뒤 lock을 인계
- 읽기 전용·잠금 미지원·revision 충돌 상태를 화면과 비활성화된 명령으로 표시

## Non-scope

- 서버·클라우드 동기화, 탭 상태 병합, 사용자 선택형 충돌 해결
- Web Locks 미지원 브라우저의 낙관적 localStorage lease
- 실행 중인 두 탭 사이의 애니메이션·일시 UI 상태 동기화

## Dependencies

- IRPG-303 A/B 슬롯과 단조 revision
- 실제 동일 browser context의 두 페이지 Playwright fixture
- `storage` 이벤트와 Web Locks API를 제공하는 최신 Chromium·Edge

## Impacts

- Save schema: compatible; `GameState`와 envelope 형식은 바꾸지 않음
- Content config: none
- Accessibility: 읽기 전용 원인과 명령 비활성 상태를 텍스트로 제공

## Acceptance criteria

- Given revision N을 읽은 탭에서 다른 writer가 N+1을 저장했을 때, when 오래된 탭이 N을 기대해 저장하면, then 충돌을 반환하고 A/B 슬롯 원문은 바뀌지 않는다.
- Given 같은 origin의 첫 탭이 writer lock을 보유할 때, when 두 번째 탭을 열면, then 두 번째 탭은 오프라인 정산·tick·저장을 수행하지 않고 모든 상태 변경 명령이 비활성화된다.
- Given reader가 열린 상태에서 writer가 저장할 때, when `storage` 이벤트가 전달되면, then reader는 검증된 최신 revision을 표시한다.
- Given writer 탭이 닫혔을 때, when reader가 lock을 재시도하면, then 3초 안에 writer가 되어 마지막 저장 이후 구간을 한 번만 정산한다.
- Given Web Locks를 지원하지 않는 브라우저일 때, when 게임을 열면, then 데이터 보호를 위해 읽기 전용으로 시작하고 이유를 표시한다.

## Design

`bootstrapGame`은 `writer`와 `reader` 모드를 구분한다. writer 모드만 경과 시간을 전진시키고 기대 revision 기반 checkpoint를 기록한다. reader 모드는 저장 원문을 decode·정규화해 표시만 하며 `lastSavedAt`이나 슬롯을 바꾸지 않는다.

`saveGameAtRevision(storage, state, expectedRevision)`은 쓰기 직전 최신 유효 revision을 다시 읽는다. 값이 다르면 `conflict`, 읽기 오류·미래 포맷이면 `blocked`, 검증된 반대 슬롯 쓰기까지 끝나면 새 revision을 포함한 `saved`를 반환한다. 이 guard는 오래된 순차 쓰기를 막고, Web Lock은 동시에 같은 revision을 본 두 탭의 race를 직렬화한다.

브라우저 hook은 lock 획득 전 reader bootstrap만 수행한다. lock callback을 탭 생명주기 동안 열어 두고, reader는 1초 간격으로 `ifAvailable` 획득을 재시도한다. 충돌이나 외부의 더 새 revision을 감지한 writer는 즉시 tick·명령·저장을 중단한다.

## Verification

- Review: 독립 리뷰 3개에서 충돌 후 stale UI, 영구 재시도 차단, 초기화 두 번째 쓰기 실패, 물리적 multi-key clear 경쟁 조건을 발견했다.
- Verify: 충돌 시 검증된 reader snapshot으로 즉시 되돌리고 recoverable conflict만 lock을 재시도한다. 초기화는 단조 revision의 동일 초기 상태를 두 슬롯에 차례로 기록하며 어느 쓰기든 실패하면 읽기 전용으로 전환한다.
- Verify: 기대 revision 불일치와 동일 revision의 divergent A/B 상태는 쓰기 전에 거부되어 두 슬롯 원문이 보존된다. reader bootstrap은 전투 시간과 `lastSavedAt`을 전진시키지 않는다.
- Verify: Web Lock callback이 writer 생명주기 전체를 감싸고 writer 선출 전에 writer bootstrap·오프라인 정산·timer가 실행되지 않음을 확인했다.
- Test: 두 Chromium 페이지에서 reader 비활성화, 열린 reader의 저장 이벤트 반영, writer 종료 뒤 3초 이내 인계를 확인했다.

## Test evidence

- `src/game/persistence.test.ts`: stale revision A/B byte 불변, reader 무쓰기·무정산, 동일 revision divergent 상태 차단
- `src/hooks/useGame.test.tsx`: Web Locks 미지원 시 10초 동안 no-write reader, bootstrap read 오류 write latch
- `e2e/multi-tab.spec.ts`: 두 번째 탭 read-only, 상태 변경 버튼 비활성, writer 구매의 열린 reader 반영, writer 종료 뒤 자동 인계, 다음 reader의 최신 상태 확인
- `npm run verify` (2026-07-17): lint, strict typecheck, Vitest 5 files / 32 tests, production build, Playwright 2/2 통과
