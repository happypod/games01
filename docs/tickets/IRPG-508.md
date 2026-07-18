# IRPG-508 — 7일 장기 stress 회귀

## Outcome

7일 가속 게임 시간에서 숫자·결정론·정체·snapshot 크기 회귀를 일별 기준값으로 탐지한다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: ENG-SIM, QA-DOMAIN
- Owner / Reviewer: unassigned / simulation and CI reviewers

## Scope

- 초기·진행·상한 저장의 7일 100x headless 실행
- 매 24시간 전체 상태·report snapshot과 고정 fixture
- safe integer·stage·HP·RNG·진행·snapshot 크기 검사
- PR 24시간 smoke와 주간 7일 scheduled CI의 실행·차단 정책

## Non-scope

- 실제 벽시계 7일 대기, 브라우저 렌더 soak
- wall-clock 성능의 불안정한 절대 pass/fail
- 이벤트 점프·Web Worker 최적화 구현

## Dependencies

- IRPG-505 24시간 runner와 상한 저장 기준선

## Impacts

- Save schema: none
- Content config: none
- Accessibility: none; headless test

## Acceptance criteria

- Given 초기·진행·상한 fixture일 때, when 7일을 가속 실행하면, then 매일 snapshot과 최종 상태가 반복 실행·청크 분할에서 정확히 같다.
- Given 각 snapshot일 때, when 불변식을 검사하면, then 안전 정수·HP·stage·RNG·저장 가능성을 유지하고 초기·진행 fixture는 일별 kills 또는 defeats가 증가하며 상한 fixture는 일별 report `rounds > 0`인 명시적 heartbeat를 만족한다.
- Given 일별 snapshot과 전체 fixture를 serialize할 때, when byte 길이를 측정하면, then 각 canonical JSON은 16 KiB 이하이고 7일 fixture 전체는 128 KiB 이하이며 초과 시 실패한다.
- Given CI 비용일 때, when 정책을 적용하면, then 24시간 `test:soak`는 모든 PR의 required check이고 7일 `test:stress`는 매주 일요일 03:00 UTC와 `workflow_dispatch`에서 10분 timeout으로 실행된다.
- Given release 후보일 때, when tag 승인 여부를 확인하면, then 최근 7일 안의 `test:stress` success가 없으면 release를 차단하되 일반 PR은 scheduled stress 실패만으로 차단하지 않는다.
- Given release 후보 SHA일 때, when stress 증거를 조회하면, then artifact의 requested SHA·실제 checkout SHA가 후보와 모두 일치해야 하며 다른 commit의 최근 success로 대체할 수 없다.
- Given fixture 변경일 때, when Review하면, then 관련 게임 규칙·밸런스 티켓과 전후 snapshot 차이가 기록된다.

## Design

IRPG-505의 runner를 재사용하고 각 fixture는 heartbeat를 별도로 정의한다. 초기·진행 fixture는 일별 kill/defeat counter의 단조 증가 중 하나를 요구하고, 모든 숫자가 포화될 수 있는 상한 fixture는 report의 처리 round가 양수인지 확인해 정상 정체를 실패로 오인하지 않는다. 7일 전체 상태를 모두 저장하지 않고 16 KiB 이하의 일별 snapshot 7개만 보존하며 fixture 전체는 128 KiB를 넘지 않는다.

모든 PR은 기존 24시간 soak를 required check로 유지한다. 7일 stress는 `schedule: 0 3 * * 0`와 수동 실행에서 10분 timeout으로 돌리고 일반 PR required check에는 넣지 않는다. 주간 run은 default branch 회귀를 알리지만 release 증거를 대신하지 않는다.

release candidate는 full 40-hex commit SHA를 required input으로 받는 `workflow_dispatch`가 그 SHA를 detached checkout해 실행한다. 실행은 `stress-attestation.json` artifact에 `requestedSha`, `checkedOutSha`(`git rev-parse HEAD`), canonical fixture hash와 run ID를 기록한다. release job은 성공한 run의 artifact에서 `requestedSha === checkedOutSha === candidateSha`와 fixture hash를 확인한다. dispatch ref에서 파생되는 Actions metadata `headSha`는 checkout 증거로 사용하지 않으며, 정확히 일치하는 artifact가 없으면 tag를 차단한다.

## Verification

- fixture별 heartbeat, 16/128 KiB 상한, 주간·release 차단 정책과 deterministic chunk matrix를 Review한다.

## Test evidence

- 예정: `test:stress` 7일 fixture와 scheduled CI artifact
