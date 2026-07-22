# IRPG-420 — 고정 재료 보관함·결정론 제작·소모 버프

## Outcome

사용자가 전투에서 고정 재료를 정확히 한 번 획득하고 작업대에서 확정 레시피를 제작해 1,800라운드 황금 스튜와 다음 보스 집중 물약을 전략적으로 사용한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ENG-DATA, ENG-STATE, ENG-SAVE, GD-BAL, FE-GAME, QA-DOMAIN
- Owner / Reviewer: Codex / independent economy and deterministic review

## Scope

- finite material IDs `ashShard`, `beastHide`, `emberCore`와 consumable IDs `goldStew`, `focusTonic`만 저장한다.
- 처치 대상의 stable enemy definition으로 고정 재료를 지급하며 추가 RNG draw를 사용하지 않는다.
- 한 번에 하나의 확정 제작 job을 시작하고 elapsed time으로 완료한다.
- 모든 처치는 `ashShard +1`, 황혼의 늑대 처치는 추가 `beastHide +1`, 보스 처치는 추가 `emberCore +1`을 확정 지급한다.
- `goldStew` 레시피는 `{ ashShard: 10, beastHide: 4, emberCore: 0 }`, 기본 5분이고 `focusTonic`은 `{ ashShard: 6, beastHide: 2, emberCore: 1 }`, 기본 10분이다.
- 제작 job의 시간은 시작 당시 작업대 Lv.1~5 배율 `100·90·80·70·60%`를 적용해 snapshot하며 이후 시설 확장으로 재계산하지 않는다.
- 골드 요리는 완성 전투 라운드 1,800회 동안 골드 배율 +50%다.
- 집중 물약은 다음 보스 전투에 +20%p 치명타 확률을 적용하고 해당 보스 승리·패배 시 종료한다.
- 같은 buff 활성 중 재사용을 거절해 소모·중첩 exploit을 막는다.
- 보관함·레시피 비용·남은 시간·소모품·활성 buff를 캠프 UI에 표시한다.

## Non-scope

- 랜덤 드롭·희귀도·옵션·장비 instance·정렬·가챠
- 제작 실패·랜덤 산출·다중 queue·서버 시간
- 성적 아이템·강압적 효과

## Dependencies

- IRPG-104, IRPG-106, IRPG-303, IRPG-304, IRPG-403, IRPG-419, IRPG-505, IRPG-506

## Impacts

- Save schema: schema6 `camp` 필드 사용, 추가 migration 없음
- Content config: `camp.ts`의 finite materials·recipes·buffs v1 fixed table
- Accessibility: progress·재료 부족·활성/중복 사유 검토

## Acceptance criteria

- Given 같은 seed·kill sequence일 때, when 단일·분할·offline로 실행하면, then 재료 수량은 같고 combat RNG state/draws는 기존과 같다.
- Given 레시피 비용보다 1 부족·정확히 일치·작업 중일 때, when 제작을 요청하면, then 성공만 재료 차감과 job 생성을 한 번 적용한다.
- Given 제작 job이 1ms 남음·정확히 완료·초과 elapsed일 때, then 산출물은 정확히 하나 추가되고 중복 완료되지 않는다.
- Given 골드 요리 round 1·1,800·1,801일 때, then +50%는 정확한 round에만 적용되고 camp foreground에서는 감소하지 않는다.
- Given 집중 물약이 준비됐을 때, when 다음 보스에 진입하면, then 해당 보스의 영웅 치명타 확률만 35%가 되고 승리·패배 뒤 15%로 복귀한다.
- Given default-empty schema6 캠프일 때, then 기존 전투·밸런스 snapshot은 재료 필드를 제외하고 동일하다.

## Design

재료 지급과 buff 감소는 전투 라운드의 공통 처치·완료 경계에서 처리한다. 황금 스튜의 `+0.5`는 적의 기본 처치 gold multiplier에만 들어가고 boss milestone 경로에는 적용하지 않는다. 집중 물약은 unbound `0`에서 다음 보스 stage로 bind한 뒤 같은 라운드당 RNG draw 하나에 임계값만 `0.15 → 0.35`로 바꾼다. 제작 timer는 전투·캠프 전경·offline 여부와 무관하게 elapsed를 한 번 소비하며 완료 시 소모품 하나를 추가하고 job을 제거한다. 모든 수량은 safe integer에서 포화한다.

## Verification

- Review: IRPG-419 검증 뒤 독립 economy·determinism 리뷰를 완료했고 조작된 제작 시간 상한, bound 보스 stage 인과성, 명령 전 elapsed 정산과 1회성 완료 공지를 보강했다.
- Verify: 재료/RNG 불변, 제작 원자성·시간 snapshot·exact-once 완료, 황금 스튜 1,800-round, 집중 물약 bind·승패 종료를 수용 기준에 매핑했다.
- Test: IRPG-419 Done 뒤 로컬 code·browser gate와 baseline commit `6c80e98`의 최종 GitHub 게이트를 통과했다.

## Test evidence

- `src/game/campCrafting.test.ts` 포함 targeted Vitest — 8 files·51 tests 통과
- 고정 재료와 RNG 불변, 레시피 비용·단일 job·시작 시간 snapshot, 999+1ms 단일 완료, 1,800-round 황금 스튜, 동일 RNG draw의 다음 보스 15→35% 집중 효과를 포함한다.
- 전체 로컬 증거: Vitest 47 files·395 tests, 일반 Playwright 60 tests, production cold-load 5 tests, lint·typecheck·build·asset gate 통과. 앱 종료 중 저장된 제작 job 완료와 reload 무중복 흐름을 브라우저에서 검증했다.
- canonical/CI 증거: push quality `29743295721`, PR quality `29743299219`, visual `29743295715` 성공. 전체 18 fixture·72 screenshot과 3회 반복 216개가 통과했고 artifact `8461530261`은 체크인 기준선과 72/72 byte-identical이다.
