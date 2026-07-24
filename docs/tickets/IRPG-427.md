# IRPG-427 — 결정론적 합동 연성 비용·수집 보상·중복 방지

## Outcome

동의된 캠프 합동 연성이 고정 비용으로 고정 CHAPTER I 수집 카드를 정확히 한 번 해금하며 RNG·전투 성장·보상을 우회하지 않는다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ENG-STATE, ENG-SAVE, GD-BAL, QA-DOMAIN
- Owner / Reviewer: Codex / independent deterministic economy review

## Scope

- immutable 합동 연성 정의 한 개와 골드·세 재료 고정 비용을 추가한다.
- 성공 시 전투 능력치가 아닌 고정 CHAPTER I 수집형 무기 카드를 exact-once 원장에 기록한다.
- CAMP·성인 확인·세라 동의·비용·미수령 상태를 모두 확인한 뒤 하나의 clone transaction으로 비용과 원장을 변경한다.

## Non-scope

- RNG·wall-clock·랜덤 장비·가챠·전투 능력치 증가
- 동의 거절·철회에 따른 성장 손실 또는 보상 회수
- 반복 연성·다중 레시피·CHAPTER II·III 보상

## Dependencies

- IRPG-104, IRPG-207, IRPG-420, IRPG-425, IRPG-426

## Impacts

- Save schema: IRPG-426의 schema8 원장 사용
- Content config: joint-synthesis-definitions-v1 fixed table
- Accessibility: 비용·중복·미동의 거절 사유를 텍스트로 제공

## Acceptance criteria

- Given 비용보다 한 단위 부족하거나 미동의·전투·알 수 없는 레시피일 때, when 연성하면, then 입력 상태·RNG·revision을 그대로 반환한다.
- Given 정확한 비용과 동의가 있을 때, when 연성하면, then 비용을 한 번 차감하고 고정 수집 카드 bit를 한 번 기록한다.
- Given 이미 수령한 연성, when reload·offline·환생 뒤 다시 실행하면, then 비용·보상·RNG가 변하지 않는다.
- Given 연성 전후, then `getHeroStats`, 전투 state, expedition ledger와 RNG state/draws가 같다.
- Given portable 과거 저장 복원, then 비용과 원장이 함께 해당 snapshot으로 되돌아가며 서로 다른 저장 계보를 병합하지 않는다.

## Design

첫 정의는 `chapter1.sera.ember-vow`이며 비용은 900G, 재의 파편 12, 야수 가죽 6, 불씨 핵 1이다. 보상 `chapter1.weapon.ember-vow-card`는 수집·연출 전용이고 전투 수치에는 영향을 주지 않는다.

## Verification

- 독립 결정론 리뷰에서 CAMP·18세 확인·세라 동의·비용·미수령 조건을 모두 확인한 뒤 하나의 clone transaction으로만 차감·원장을 교환함을 확인했다.
- 비용-1·unknown·duplicate는 입력 객체·revision·RNG를 보존하고, 성공은 900G·재의 파편 12·야수 가죽 6·불씨 핵 1과 보상 bit를 정확히 한 번 교환한다.
- reload·offline·환생·portable 왕복 뒤에도 지급 원장이 유지되고 전투 능력치·expedition·RNG state/draws가 같음을 확인했다.

## Test evidence

- `src/game/campBond.test.ts`, `src/game/campPersistence.test.ts`, `src/game/saveTransfer.test.ts`, `src/game/debugSimulator.test.ts`가 비용 경계·exact-once·저장·환생 불변을 고정한다.
- `e2e/bond-facilities.spec.ts`가 성공 저장 뒤에만 연출을 시작하고 reload 뒤 중복 버튼·재차 비용 차감을 차단함을 실제 A/B 저장 UI에서 통과했다.
- 최종 `npm run verify`의 Vitest 461개와 일반 Playwright 65/65가 통과했다.
