# IRPG-206 — 환생 후 최고점 재도달 튜닝

## Outcome

첫 환생의 영구 보너스가 체감 가능한 재진행 가속을 만들면서 첫 원정 30~45분 기준선을 깨지 않는다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Ready
- Skill tags: GD-BAL, PLAYTEST, QA-DOMAIN
- Owner / Reviewer: Codex / independent balance, engine, save, and QA reviewers

## Scope

- 불씨 정수 1개당 공격력·최대 체력 영구 효과를 `3% → 4.2%`로 조정
- IRPG-204의 동일 10개 seed·전략을 비동료와 IRPG-108 동료 영입·훈련 두 cohort로 실행
- 첫 원정 → 즉시 `performPrestige` → 같은 프로필의 stage 30 재도달을 한 paired session으로 측정
- 첫 원정 기준선, 환생 초기화·RNG 연속성, 중간 저장 reload, safe integer, 24시간 soak 회귀

## Non-scope

- 첫 환생 정수 보상 5개, 정수 지급 공식, stage·적 HP·골드·XP·장비·스킬·동료 수식 변경
- 저장 schema·migration, 기존 정수 수량의 소급 변경, IRPG-207 보스 최초 보상
- 외부 사용자 재미·이해 검증과 장기 다중 환생 경제 재설계

## Dependencies

- IRPG-203 환생·영구 성장
- IRPG-204 첫 환생 밸런스 기준선
- IRPG-104 저장 가능한 RNG·치명타
- IRPG-108 첫 동료 영입·협공
- IRPG-505 1x·10x·100x와 24시간 soak 기준선

## Impacts

- Save schema: none. 저장에는 정수 개수만 있으며 파생 공격력·체력은 load 시 새 수식으로 다시 계산한다.
- Balance config: `ESSENCE_STAT_BONUS_PER_POINT = 0.042`; stage 30 첫 환생의 정수 5개는 `1.15 → 1.21` 배율이 된다.
- UI copy: 환생 panel의 영구 효과 설명을 동일 상수에서 `4.2%`로 표시한다.
- Existing saves: 보유 정수 수량과 RNG·revision은 그대로이며 해당 정수의 파생 능력치만 즉시 상향된다.

## Measurement contract

- 각 paired ratio는 `재도달 소요 초 / 같은 프로필 첫 원정 소요 초 × 100`이며 profile별 ratio의 중앙값을 cohort KPI로 사용한다. 두 시간을 독립 seed로 다시 시작하거나 cohort 전체 시간의 비율을 사용하지 않는다.
- 첫 원정이 stage 30에 도달한 즉시 환생한다. 두 번째 timer는 `performPrestige`가 반환한 상태에서 0으로 시작하고 RNG state·draws를 이어받는다.
- 비동료 cohort는 두 원정 모두 동료를 영입하지 않는다. 동료 cohort는 첫 보스 뒤 영입·훈련하고 환생 뒤 유지된 ID·rank 1에서 같은 구매 cadence로 재개한다.
- 각 원정의 목표는 `battle.highestStage >= 30`이고 최대 60분이며, 입력 GameState를 mutation하지 않고 같은 profile 재실행의 초·최종 상태 hash가 일치해야 한다.

## Selected tuning

- 현행 `3%` 재계측은 비동료 중앙값 71.3%(범위 66.6~80.7), 동료 중앙값 74.6%(범위 64.1~80.7)로 각각 7/10·8/10이 70%를 초과한다.
- `4.0%` 후보는 중앙값은 통과하지만 각 cohort 한 세션씩 70%를 초과해 제외한다.
- `4.2%` 후보는 비동료 중앙값 63.3%(58.6~69.3), 동료 중앙값 63.5%(60.8~69.9)이며 20/20 ratio가 범위 안이다.
- 첫 환생 고정 추가 배율은 새 규칙과 HP 계산 순서를 만들고, 정수 보상 5→7은 legacy 저장 소급 불가와 IRPG-207 경제 충돌이 있어 제외한다.

## Acceptance criteria

- Given 비동료·동료 각 10개 paired session일 때, when 첫 환생 전후의 stage 30 도달 시간을 비교하면, then 각 cohort 중앙값과 20/20 profile ratio가 모두 50~70%다.
- Given 각 session일 때, when 환생과 재도달을 반복 실행하면, then 첫 보상은 정수 5개, 임시 진행은 초기화, 동료 계약은 유지·rank 1, RNG는 연속이며 입력·초·최종 상태 hash가 결정론적이다.
- Given 중간 재도달 저장일 때, when A/B encode/decode 뒤 계속 실행하면, then 중단 없는 실행과 도달 초·RNG·최종 상태가 같다.
- Given 튜닝 뒤일 때, when IRPG-204·108 회귀를 실행하면, then 비동료 첫 원정 중앙값 1,984.5초와 동료 1,865초, 모든 세션 30~45분, 장기 적 HP 1.15 곡선이 그대로다.
- Given 정수 `0`, `5`, `Number.MAX_SAFE_INTEGER`일 때, when 영웅 능력치를 계산하면, then 0 정수 기준은 변하지 않고 5 정수는 1.21 배율이며 모든 결과가 safe integer로 포화된다.

## Discovery evidence

- IRPG-204의 74.4% 수치는 IRPG-108 이전 자료라 Ready 승격 시 폐기했다. 현 엔진의 paired 재계측은 `Selected tuning`의 두 cohort 수치를 canonical 기준으로 사용한다.

## Verification

- formula 단일 상수, paired ratio 계산, 첫 원정 불변, 환생·RNG·저장 연속, 두 cohort 20개 exact fixture와 장기 HP·soak 영향을 독립 Review한다.

## Test evidence

- 예정: `balance.test.ts` 두 cohort 첫→환생→재도달 exact summaries·hash, `formulas` 0/5/MAX 경계, persistence 중간 checkpoint, 기존 IRPG-204·108·505 회귀와 전체 `npm run verify`
