# IRPG-421 — 결정론 이벤트 상인·성인 구조 계약·신뢰

## Outcome

사용자가 결정론적으로 갱신되는 캠프 상인을 이용하고, 성인 NPC 구조를 지원한 뒤 별도의 자발적 계약과 신뢰 성장을 선택해 캠프 효율을 확장한다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Done
- Skill tags: ENG-DATA, ENG-STATE, ENG-SAVE, NARRATIVE, FE-GAME, QA-DOMAIN
- Owner / Reviewer: Codex / independent consent, economy and accessibility review

## Scope

- 30분 elapsed마다 fixed three-cycle merchant offer를 갱신하고 cycle·남은 시간·구매 mask를 저장한다.
- offer는 재료 보급, 완성 소모품, 구조 지원 의뢰로 제한하며 RNG를 사용하지 않는다.
- 구조 지원 완료는 성인 NPC 세라를 `rescued`로만 만들고 전투 동료·소유 대상으로 자동 변환하지 않는다.
- 사용자가 별도 `자발적 계약 제안`을 승인해야 `contracted`가 된다.
- 계약 후 고정 gold cost로 trust 0~5를 올리고 rank당 상인 가격 2%, 최대 10% 할인을 제공한다.
- 세라는 캠프 전문 주민이며 기존 `player.companion`의 단일 전투 편성 계약을 바꾸지 않는다.
- 상인·구조·계약·신뢰 상태와 구조 지원·자발성 설명을 UI에 표시한다.

고정 offer table은 다음과 같다. 가격은 세라 신뢰 할인 전 기준이며, 각 행의 슬롯은 해당 cycle에서 한 번만 구매할 수 있다.

| `cycle % 3` | 슬롯 0 | 슬롯 1 | 슬롯 2 |
|---:|---|---|---|
| 0 | 재의 파편 10개 · 120G | 황금 스튜 1개 · 420G | 세라 구조 지원 · 800G |
| 1 | 야수 가죽 6개 · 220G | 집중 물약 1개 · 620G | 재의 파편 18개 · 260G |
| 2 | 불씨 핵 1개 · 520G | 야수 가죽 10개 · 360G | 황금 스튜 1개 · 380G |

신뢰 0→1, 1→2, 2→3, 3→4, 4→5 비용은 각각 `250·500·900·1,500·2,400G`다. 계약된 세라의 신뢰 rank당 모든 offer 가격을 2% 할인하고, `round(baseCost × (1 - discount))`로 계산해 rank 5에서 10%로 제한한다.

## Non-scope

- 노예·포획·소유·강제 복종·조교·거절 불이익·성행위·노골적 CG
- 둘 이상의 전투 동료 동시 편성, 전투 roster 전환, 동료 장비·사망·가챠
- 실시간 서버 상점·일일 reset·유료 재화·결제

## Dependencies

- IRPG-107, IRPG-108, IRPG-207, IRPG-303, IRPG-304, IRPG-403, IRPG-412, IRPG-417, IRPG-420, IRPG-506

## Impacts

- Save schema: schema6 `camp` field 사용, 추가 migration 없음
- Content config: merchant/contracts v1 fixed table
- Accessibility: offer 만료 설명, exact-once purchase, consent copy와 상태 발표 검토

## Acceptance criteria

- Given 같은 cycle일 때, when reload·offline·분할 timer를 비교하면, then offer·남은 시간·구매 mask가 같고 combat RNG가 변하지 않는다.
- Given 구매 비용보다 1 부족·정확히 일치·이미 구매했을 때, when offer를 구매하면, then 성공만 gold와 지급물/상태를 한 transaction으로 변경한다.
- Given 구조 지원 offer를 구매했을 때, then 세라는 `rescued`가 되지만 전투 편성·계약·trust는 바뀌지 않는다.
- Given rescued 상태일 때, when 사용자가 계약을 명시적으로 승인하면, then 한 번만 `contracted`가 되고 보류·중복 입력에는 재화·revision 변화가 없다.
- Given trust rank 0~5일 때, when 상인 가격을 계산하면, then 각각 0~10% 고정 할인이 적용되고 최대 뒤 신뢰 활동을 거절한다.
- Given reload·offline·환생·portable 복원일 때, then merchant·resident ledger가 보존되고 구조·구매·신뢰 보상이 중복되지 않는다.
- Given 구조·계약 화면과 fallback copy일 때, then 구조 지원이 계약을 자동 체결하지 않고 계약은 별도 자발적 선택이며 보류 가능함을 명시하고 강압적·성적 보상을 암시하지 않는다.

## Design

상인은 wall-clock 날짜가 아니라 저장된 remaining elapsed와 safe-integer에서 포화하는 cycle을 사용한다. offer는 `cycle % 3`의 immutable table에서 파생하고 현재 cycle의 세 슬롯은 `purchasedOfferMask` bit 0~2로 exact-once 처리한다. 30분 경계를 넘으면 cycle을 올리고 남은 시간을 재계산한 뒤 mask를 0으로 초기화한다. `Number.MAX_SAFE_INTEGER`에 처음 도달하는 경계에서는 single/split elapsed가 같은 결과를 내도록 `refreshRemainingMs = 1,800,000`과 mask 0으로 정규화한다. 이미 terminal인 ledger에서는 overflow와 구매 복제를 피하기 위해 `cycle`·`refreshRemainingMs`·`purchasedOfferMask`를 더 갱신하지 않고 동결한다. 세라의 구조 지원 구매, 자발적 계약 승인, trust 증가는 각각 별도 캠프 전용 command이며 기존 전투 companion state와 독립이다.

## Verification

- Review: IRPG-420 검증 뒤 독립 consent·economy·accessibility 리뷰를 완료했고 성인 NPC·구조/계약 분리·보류 가능 문구, 명령 전 상인 갱신, terminal cycle single/split 동치를 보강했다.
- Verify: 30분 fixed cycle, 3-bit exact-once 구매, 구조→별도 자발적 계약→신뢰, 전투 동료 불변과 저장 계보 보존을 수용 기준에 매핑했다.
- Test: IRPG-420 Done 뒤 로컬 code·browser gate와 baseline commit `6c80e98`의 최종 GitHub 게이트를 통과했다.

## Test evidence

- `src/game/campMerchant.test.ts`: 30분 경계·분할 동치·RNG 불변, 비용-1·정확 일치·중복 구매, 구조/계약 분리, 신뢰 비용·할인 상한, reload·offline·portable·환생 원장 보존을 고정한다.
- 전체 로컬 증거: Vitest 47 files·395 tests, 일반 Playwright 60 tests, production cold-load 5 tests, lint·typecheck·build·asset gate 통과. 브라우저에서 구조 지원, 별도 자발적 상점 조언 계약, 신뢰 할인과 reload 보존을 검증했다.
- canonical/CI 증거: push quality `29743295721`, PR quality `29743299219`, visual `29743295715` 성공. 전체 18 fixture·72 screenshot과 3회 반복 216개가 통과했고 artifact `8461530261`은 체크인 기준선과 72/72 byte-identical이다.
