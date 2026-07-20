# IRPG-419 — 캠프 시설·영구 훈련·오프라인 상한 성장

## Outcome

사용자가 골드로 텐트·작업대·단련소를 성장시키고, 영구 공격·체력 훈련과 텐트 1~5단계의 8~12시간 오프라인 상한을 명확한 비용·효과와 함께 관리한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: GD-BAL, ENG-STATE, ENG-SAVE, FE-GAME, QA-DOMAIN
- Owner / Reviewer: Codex / independent balance and domain review

## Scope

- 시설은 텐트·작업대·단련소 각 Lv.1~5의 고정 gold cost table을 사용한다. 현재 Lv.1→2부터 Lv.4→5까지 텐트는 `600·1,500·3,600·8,000`, 작업대는 `450·1,100·2,700·6,200`, 단련소는 `500·1,250·3,000·7,000` 골드다.
- 텐트 상한은 Lv.1~5에서 8·9·10·11·12시간이다.
- 작업대는 제작 기본 시간에 Lv.1~5에서 100·90·80·70·60% 배율을 제공한다.
- 단련소 단계마다 공격·체력 훈련 최대 rank를 5씩 연다.
- 공격 훈련 rank당 +2, 체력 훈련 rank당 +20을 기존 파생 능력치의 마지막 flat 항으로 적용한다.
- 훈련 비용은 현재 rank `r`에서 공격 `round(140 × 1.45^r)`, 체력 `round(160 × 1.45^r)` 골드이며 1 이상 안전 정수로 포화한다.
- 시설과 훈련은 reload·offline·환생 뒤 보존한다.
- 캠프 시설 grid와 훈련 조작·현재/다음 효과·오프라인 상한을 표시한다.

## Non-scope

- essence 소비, 시설 배치 좌표 편집, 건설 대기열·실패 확률
- 전투 동료 추가 편성, 랜덤 장비·아이템 instance
- 작업대 레시피 활성화는 IRPG-420

## Dependencies

- IRPG-203, IRPG-204, IRPG-206, IRPG-303, IRPG-304, IRPG-403, IRPG-418, IRPG-505, IRPG-506

## Impacts

- Save schema: schema6 `camp` 필드 사용, 추가 migration 없음
- Content config: facility/training cost·effect table v1 추가
- Accessibility: 비용·잠금·최대 사유, 44px 조작, live notice 검토

## Acceptance criteria

- Given 비용보다 1 부족·정확히 일치·최대 단계일 때, when 시설 또는 훈련 명령을 실행하면, then 성공만 비용과 rank를 한 transaction으로 변경하고 거절은 입력 상태와 revision을 보존한다.
- Given 텐트 Lv.1~5일 때, when 오프라인 상한을 계산하면, then 각각 8·9·10·11·12시간이며 초과 구간은 지급하지 않는다.
- Given 같은 elapsed가 텐트 상한 안일 때, when 단일·분할·bootstrap을 비교하면, then state·RNG·보상이 같다.
- Given 공격·체력 훈련 성공일 때, then 승인된 flat 효과만 증가하고 체력 훈련은 증가한 최대 HP만큼 현재 HP를 안전하게 회복한다.
- Given 환생·reload·portable 복원일 때, then 시설과 훈련은 계약대로 보존되고 활성 전투 수식은 같은 상태에서 재현된다.
- Given 캠프 구매를 하지 않은 기본·migration 상태일 때, then IRPG-204·206 기존 진행 시간·RNG·보상 기준선은 변하지 않는다.

## Design

시설 비용과 효과는 immutable `camp-facilities-v1` config와 selector에서 파생한다. 텐트 `8·9·10·11·12시간`, 작업대 `100·90·80·70·60%`, 단련소 훈련별 `5·10·15·20·25 rank`를 단계에 직접 매핑한다. gold만 소비하고 시설·훈련 명령은 `CAMP`에서만 clone에 비용 차감과 단계 증가를 함께 적용해 기존 essence 총량 기반 4.2% 영구 효과와 충돌하지 않는다. 작업대는 이 티켓에서 시간 selector만 제공하며 실제 제작 버튼은 IRPG-420 전까지 비활성 설명으로 표시한다.

## Verification

- Review: 독립 balance·domain 리뷰를 완료했고 debug offline도 실제 텐트 상한과 같은 engine path를 사용하도록 통일했으며 A/B·portable·환생 보존과 비용/잠금/MAX 문구를 대조했다.
- Verify: 고정 비용·효과 selector, 캠프 전용 원자 거래, 파생 능력치 마지막 flat 항, 텐트별 offline clamp와 시작 당시 작업대 시간 snapshot을 수용 기준에 매핑했다.
- Test: IRPG-418 Done 뒤 로컬 code·browser gate와 baseline commit `6c80e98`의 최종 GitHub 게이트를 통과했다.

## Test evidence

- `npm run typecheck` — 통과
- `node node_modules/vitest/vitest.mjs run src/game/campFacilities.test.ts src/game/campPersistence.test.ts src/components/GameScreen.test.tsx src/hooks/useGame.test.tsx` — 4 files·24 tests 통과
- 전체 로컬 증거: Vitest 47 files·395 tests, 일반 Playwright 60 tests, production cold-load 5 tests, lint·typecheck·build·asset gate 통과. 통합 브라우저에서 텐트 Lv.4→5, 공격 훈련, 비용·MAX 문구와 저장 복원을 조작했다.
- canonical/CI 증거: push quality `29743295721`, PR quality `29743299219`, visual `29743295715` 성공. 전체 18 fixture·72 screenshot과 3회 반복 216개가 통과했고 artifact `8461530261`은 체크인 기준선과 72/72 byte-identical이다.
