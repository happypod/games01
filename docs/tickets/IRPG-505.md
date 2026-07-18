# IRPG-505 — 배속 디버그·24시간 soak

## Outcome

동일한 저장 상태·seed·총 게임 시간을 1x·10x·100x 청크로 실행해도 8·16·24시간 상태와 누적 전투 보고가 정확히 같고, 장시간 숫자 폭주·정체·결정론 회귀를 CI에서 탐지한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: QA-DOMAIN, PLAYTEST, ENG-SIM
- Owner / Reviewer: Codex / independent simulation review

## Scope

- DOM·브라우저 타이머·저장소를 모르는 순수 `debugSimulator` 러너
- 1x·10x·100x 청크와 동일한 24시간 게임 시간
- 8시간 오프라인 상한을 존중하는 8·16·24시간 전체 상태·누적 report snapshot
- 안전 정수·비음수·HP·stage·강화·스킬·RNG·round 불변식과 진행 정체 탐지
- 유효한 최대 안전 정수 저장의 보상·경험치·카운터·환생 포화와 과대 쿨다운 정규화
- checked-in 고정 seed snapshot fixture와 전용 `npm run test:soak` 명령

## Non-scope

- 실제 벽시계 24시간 대기, 브라우저 개발자 치트 패널, 7일 soak
- 자동 구매·환생 전략, 밸런스 튜닝, Web Worker·이벤트 점프 최적화
- 저장 schema·핵심 보상 배율·성장 수식 변경

## Dependencies

- IRPG-104 저장 가능한 RNG·결정론적 치명타
- IRPG-204 첫 환생 밸런스 기준선

## Impacts

- Save schema: none; 기존 유효 저장의 쿨다운은 decode 시 최대 5초로 정규화
- Content config: none
- Engine invariant: 피해·보상·누적 상태·report는 최대 안전 정수에서 포화
- Accessibility: none; headless developer harness

## Acceptance criteria

- Given 같은 초기 상태와 seed일 때, when 24시간 게임 시간을 1x·10x·100x로 실행하면, then 8·16·24시간의 전체 상태와 누적 report가 정확히 같다.
- Given 24시간 soak일 때, when 각 8시간 경계를 검사하면, then 총 86,400 round·RNG draw가 실행되고 각 구간에 처치 또는 패배가 있어 전투가 정지하지 않는다.
- Given 모든 snapshot일 때, when 상태와 report를 검사하면, then 모든 숫자가 안전한 정수·비음수이고 HP·stage·강화·스킬·RNG·round 범위 계약을 만족한다.
- Given 별도 3×8시간 엔진 실행과 checked-in fixture일 때, when 비교하면, then debug 러너의 snapshot과 정확히 같고 입력 상태는 변경되지 않는다.
- Given 전체 릴리스 게이트일 때, when `npm run verify`와 `npm run test:soak`를 실행하면, then 둘 다 통과한다.

## Design

배속은 게임 규칙을 바꾸지 않고 한 번의 `advanceGame` 호출에 전달하는 청크 크기만 1·10·100초로 바꾼다. 러너는 snapshot 경계를 넘지 않도록 청크를 분할하며 24시간을 세 개의 8시간 관측 구간으로 실행한다. 각 엔진 호출은 `MAX_OFFLINE_MS` 이하여야 한다.

고정 fixture는 전체 `GameState`와 누적 `AdvanceReport`를 8·16·24시간마다 보존한다. fixture 변경은 게임 규칙 또는 결정론 결과가 바뀌었음을 Review에서 명시적으로 승인해야 한다.

## Verification

- 독립 리뷰에서 초기 soak가 최대 안전 정수의 유효 저장을 다루지 못해 다음 처치 뒤 report·카운터가 범위를 넘고 저장 검증이 실패할 수 있음을 발견했다.
- 피해·보상·경험치·자원·처치/패배·환생·report 누적을 최대 안전 정수에서 포화하고 과대 쿨다운을 decode 시 5초로 정규화했다.
- 재검토에서 stage 300 상한 저장의 1x·10x·100x 8시간 일치, 별도 패배·레벨업·환생 경계, 입력 불변, 3×8시간 canonical, fixture·누적 report를 확인했으며 P0/P1이 없었다.

## Test evidence

- [IRPG-505 24시간 soak 계측](../../artifacts/irpg-505-soak.md)
- `npm run test:soak`: node 환경 Vitest 1파일·5테스트 통과. 1x·10x·100x snapshot, 3×8시간 canonical, 고정 fixture, 초기·상한 저장 불변식과 잘못된 옵션을 검증한다.
- `npm run verify`: ESLint, strict typecheck, Vitest 10파일·63테스트, production build, Playwright 6테스트 통과.
