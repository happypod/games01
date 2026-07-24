# IRPG-423 — 캠프 치유 화로·회복 물약 상태 계약

## Outcome

사용자가 캠프에서 재료를 지불해 안전하게 완전 회복하고, 확정 레시피로 회복 물약을 제작·장착해 전투 중 정확히 한 번 소비한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: GD-BAL, ENG-STATE, ENG-SAVE, FE-GAME, QA-DOMAIN
- Owner / Reviewer: Codex / independent deterministic and save review

## Scope

- 캠프 전용 `치유 화로` 명령을 추가한다. 손실 HP 비율에 따라 재의 파편 `1~5개`를 소비하고 최대 HP까지 회복한다.
- `healingPotion` 소모품과 재의 파편 4개·야수 가죽 2개·기본 120초의 확정 작업대 레시피를 추가한다.
- 저장되는 빠른 소모품 장착 상태 `quickConsumable`을 추가하고 전투·캠프에서 회복 물약을 장착할 수 있게 한다.
- 전투 중 장착된 회복 물약은 최대 HP의 35%를 반올림해 회복하고 정확히 1개만 차감한다.
- 스테이지 재선택이 HP와 스킬·동료 cooldown을 무료 초기화하지 않도록 기존 우회 경로를 차단한다.
- schema6 저장을 schema7·camp definition v2로 무손실 이전한다.

## Non-scope

- 랜덤 포션 효과·제작 실패·다중 queue·자동 포션 사용
- 치유 시설 레벨·쿨다운·서버 시간
- 랜덤 장비 인벤토리·장비 instance·소모품 단축키 사용자 지정
- 전투 피해·치명타·보상·환생 수식 변경

## Dependencies

- IRPG-104, IRPG-108, IRPG-303, IRPG-304, IRPG-305, IRPG-403
- IRPG-418, IRPG-419, IRPG-420, IRPG-422, IRPG-505, IRPG-506
- schema6 legacy save fixture와 기존 A/B envelope v3·portable export v1 계약

## Impacts

- Save schema: schema6 → schema7 migration required; envelope v3·portable v1 유지
- Content config: camp definition v1 → v2, consumable·recipe fixed table 확장
- Balance: 화로 비용과 물약 회복량 고정, 스테이지 선택 무료 회복 제거
- Accessibility: full HP·재료 부족·미장착·수량 0·읽기 전용 사유 제공

## Acceptance criteria

- Given HP가 일부 손실됐을 때, when CAMP에서 치유 화로를 사용하면, then `max(1, ceil(손실HP / 최대HP × 5))`개의 재의 파편만 차감하고 HP를 최대치로 회복한다.
- Given 최대 HP·재료가 비용보다 1 부족·BATTLE·읽기 전용일 때, when 화로를 요청하면, then 입력 상태·RNG·재화가 변하지 않는다.
- Given 작업대가 비어 있고 레시피 비용과 정확히 같은 재료가 있을 때, when 회복 물약 제작을 시작하면, then 재료를 한 번 차감하고 시작 시 작업대 배율을 적용한 단일 job을 만든다.
- Given 제작 완료 1ms 전·정확한 완료·초과 elapsed일 때, then 회복 물약은 경계 이후 정확히 하나만 지급된다.
- Given 회복 물약을 장착하고 BATTLE에서 HP가 손실됐을 때, when 사용하면, then 최대 HP의 35%만큼 회복하고 상한을 넘지 않으며 수량만 하나 감소한다.
- Given 미장착·수량 0·최대 HP·CAMP일 때, when 전투 사용을 요청하면, then 상태와 RNG draw·보상·전투 event cursor가 변하지 않는다.
- Given schema6 raw/A/B/portable 저장일 때, when 읽으면, then 기존 캠프·제작 job·RNG·보상 원장을 보존한 schema7 상태에 `healingPotion: 0`, `quickConsumable: null`만 추가한다.
- Given 현재 또는 해금 스테이지를 선택할 때, then 영웅 HP와 영웅·동료 cooldown은 보존되고 현재 최대 HP 안에서만 clamp된다.

## Design

`healAtCamp`, `equipQuickConsumable`, `useEquippedConsumable`을 순수 엔진 명령으로 둔다. 화로 비용은 `missingRatio × 5`의 올림을 `1~5`로 제한하고 성공 시에만 재료 차감과 완전 회복을 한 transaction으로 적용한다. 회복 물약은 기존 단일 `CampCraftJob` timer를 재사용하며 전투 사용은 RNG를 소비하지 않는다. 수량이 0이 되어도 장착 상태는 유지해 재제작 뒤 재장착 부담을 없앤다.

schema7 migration은 schema6 캠프 원장을 복제하고 새 필드만 기본값으로 채운다. `hasFutureExpeditionDefinitionVersion`과 `hasFutureCampDefinitionVersion`은 schema6 future fence를 계속 인정한다. A/B revision과 portable envelope 버전은 바꾸지 않는다.

## Verification

- 구현 전 감사: 현재 스테이지 재선택의 무료 완전 회복·cooldown 초기화가 신규 회복 경제를 우회하는 결함임을 확인해 같은 티켓에 포함했다.
- 순수 엔진 명령, schema6→7 migration, A/B·portable 보존 경로를 독립 결정론·저장 리뷰로 확인했고 P0/P1 결함은 없었다.
- Review → Verify → Test 순서로 스테이지 재선택 우회 수정, 회복·제작·장착·사용 경계와 브라우저 통합 흐름을 검증했다. 화면 배치와 Ubuntu canonical 승인은 후속 IRPG-424가 소유한다.

## Test evidence

- `src/game/campRecovery.test.ts`, `src/game/campPersistence.test.ts`, `src/game/saveTransfer.test.ts`, `src/hooks/useGame.test.tsx`, `src/components/CampDashboard.test.tsx`, `src/components/TacticalActionBar.test.tsx`에 비용 경계·exact-once·migration·읽기 전용·UI 명령 수용 기준을 고정했다.
- `e2e/camp-recovery.spec.ts`의 치유→제작→장착→피격→전투 1회 사용 흐름이 통과했고, 전체 일반 Playwright `62/62`와 production asset Playwright `5/5`가 통과했다.
- 2026-07-22 최종 `npm run verify`는 lint·typecheck, Vitest `49파일/432개`, manifest validator `33/33`, production manifest `30 ID`, production build, 일반 Playwright `62/62`, production asset Playwright `5/5`를 통과했다. Windows canonical 비교는 계약대로 skip됐고 화면 승인은 IRPG-424로 이관했다.
