# IRPG-204 — 첫 환생 30~45분 밸런스 플레이테스트

## Outcome

신규 원정의 합리적인 성장 결정을 10회 반복했을 때 첫 환생 관문 도달 시간 중앙값이 30~45분이고, 어떤 세션도 진행이 영구 차단되지 않는다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: GD-BAL, PLAYTEST, QA-DOMAIN
- Owner / Reviewer: Codex / independent balance review

## Scope

- IRPG-104 치명타를 포함한 적 HP 성장 곡선 재조정
- seed, 구매 판단 주기, 장비·스킬 우선순위가 다른 10개 가속 플레이 세션
- 첫 강화, 첫 보스, 30스테이지 관문, 구매 수, 패배 수 기록
- 중앙값·최솟값·최댓값과 진행 차단 여부를 회귀 테스트로 고정
- 대표 전략의 실제 브라우저 UI 강화·진행 spot check

## Non-scope

- 10명의 외부 사용자 UX·재미 조사, 통계적 유의성 주장
- 환생 이후 장기 경제, 오프라인 최적 전략, 결제·라이브 운영 밸런스
- 보스 제한 시간, 신규 장비·스킬·콘텐츠 추가

## Dependencies

- IRPG-203 환생
- IRPG-502 45분 자동 시뮬레이션
- IRPG-104 저장 가능한 RNG·치명타

## Impacts

- Save schema: none
- Content config: enemy HP growth changed
- Accessibility: none

## Acceptance criteria

- Given 고정된 10개 seed·성장 전략·5~20초 구매 판단 주기일 때, when 각 세션을 최대 60분 시뮬레이션하면, then 30스테이지 도달 시간 중앙값이 30~45분이다.
- Given 같은 플레이 세션 정의일 때, when 반복 실행하면, then 각 milestone·최종 상태가 동일하다.
- Given 10개 세션일 때, when 결과를 검토하면, then 모두 60분 안에 30스테이지에 도달하고 NaN·음수 자원·영구 정체가 없다.
- Given 대표 활성 전략의 고정 60초 세션일 때, when 실제 브라우저 UI에서 전투와 강화를 수행하면, then 스테이지·자원·장비·스킬·처치/패배 표시가 고정 기준과 일치하고 page/console error가 없다.
- Given 튜닝된 적 공식일 때, when `npm run verify`를 실행하면, then 저장·E2E·접근성 회귀를 포함한 전체 게이트가 통과한다.

## Design

세션은 1초 전투 엔진을 그대로 사용하고 5·10·15·20초마다 사용 가능한 자원을 소비한다. 장비 전략은 `cheapest`, `offense`, `balanced`, 스킬 우선순위는 공격·생존·재화 순서를 섞어 최적 단일 봇에만 맞춘 곡선을 피한다. seed는 티켓에 고정해 결과를 재현한다.

튜닝 변수는 적 HP 곡선 하나로 제한한다. 30스테이지까지 체감 성장률 1.188을 적용하고 31~59스테이지에서 보정을 감쇠해 60스테이지부터 기존 장기 성장률 1.15로 복귀한다. 공격력·보상·비용, 보스 4.8배와 기존 경제 계약은 유지한다.

## Verification

- 독립 재검토에서 고정 summary·최종 상태 해시, 구매 후 수치 불변식, 정확한 브라우저 기준 상태, KPI 계약, 30→60 HP taper와 후속 티켓 분리를 확인했으며 P0/P1이 없었다.
- 첫 환생 관문 중앙값 1,984.5초(33분 04.5초), 범위 1,848~2,223초(30분 48초~37분 03초), 10/10 세션 도달을 확인했다.

## Test evidence

- [IRPG-204 자동 플레이 계측표](../../artifacts/irpg-204-playtest.md): 고정 10세션 중앙값 33분 04.5초, 범위 30분 48초~37분 03초
- [대표 브라우저 UI](../../artifacts/irpg-204-browser.png): 고정 60초 시점의 스테이지·골드·장비·스킬·처치/패배 상태
- `balance.test.ts`: 10개 결과 summary와 전체 최종 상태 해시, 수치 불변식, 첫 보스 구간, 최대 정체, 30~60 taper 회귀
- 외부 사용자 이해·기대·재미 검증은 비범위이며 IRPG-205로 분리한다.
- 첫 환생 후 최고점 재도달 50~70% 보정은 IRPG-206으로 분리한다.
- `npm run verify`: ESLint, strict typecheck, Vitest 9파일·56테스트, production build, Playwright 6테스트 통과.
