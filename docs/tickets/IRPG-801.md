# IRPG-801 — 결정론적 포획 엔진 (`livingCards` 실제 상태화)

## Outcome

포획 가능(`capturable`)으로 지정된 몬스터를 처치할 때 `state.livingCards`가 결정론적 수식으로 실제 갱신되어, 현재 UI가 그 자리에서 지어내고 있는 가짜 포획 수치를 실제 엔진 상태로 대체할 수 있게 된다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Test
- Skill tags: ENG-STATE, ENG-SIM, GD-BAL
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- `src/game/types.ts`: `EnemyDefinition`에 `species: 'humanoid' | 'beast'`와 `capturable: boolean` 필드를 추가한다. `LivingCardState`는 기존 5개 필드(`cardId`, `hStage`, `captureLoyalty`, `corruptionLevel`, `isCaptured`)를 그대로 사용한다 (신규 저장 필드 없음).
- `src/game/content.ts`: `getEnemyDefinition()`이 `assetId` 기반 lookup 테이블로 `species`/`capturable`을 함께 반환하도록 수정한다. **현재 8종 몬스터(잿빛 슬라임~잊힌 용)는 전부 `capturable: false` 기본값을 유지**하여 기존 밸런스·이벤트에 어떤 행동 변화도 주지 않는다. `species` 값은 참고용 기본치만 채운다.
- `src/game/engine.ts`:
  - `resolveEnemyDefeat()`에서 `enemy.capturable === true`일 때만 `state.livingCards[enemy.assetId]`를 생성/갱신한다.
  - `captureLoyalty` 증가량은 **처치 시점에 이미 계산되어 있는 값만 사용하는 순수 함수**로 계산한다 (신규 RNG draw 없음 → 기존 시드 재현성·이벤트 스트림에 영향 없음):
    `gain = CAPTURE_LOYALTY_BASE_GAIN + round(CAPTURE_LOYALTY_HP_BONUS_MAX * (state.player.currentHp / hero.maxHp))`
  - `captureLoyalty = min(100, previous + gain)`, `isCaptured = captureLoyalty >= 100`. 이미 `isCaptured === true`인 카드는 더 이상 값이 변하지 않는다(idempotent, 상한 클램프).
  - `hStage`는 신규 로직을 만들지 않고 기존 `getActorDamageStage()` 헬퍼([types.ts](../../src/game/types.ts))를 재사용한다.
  - `corruptionLevel`은 이번 티켓에서 `0`으로 유지한다 (실제 의미와 수식은 IRPG-804에서 정의).
- `src/game/engine.test.ts`: 결정론, 상한 클램프, 비-capturable 몬스터 무영향, 구버전 저장 fixture 마이그레이션 케이스를 추가한다.

## Non-scope

- 실제 신규 몬스터(인간형/야수형) 콘텐츠·아트 제작
- 기존 8종 몬스터 중 어떤 것을 실제로 `capturable: true`로 전환할지에 대한 밸런스·내러티브 결정
- `corruptionLevel`의 실제 의미/수식, 동료화 전환, 캠프 크래프팅 연동, 합동 연성(교배) 확장 — 전부 IRPG-804
- `LivingCardConsole.tsx` UI 변경 — IRPG-802

## Dependencies

- IRPG-800 (제품 범위)
- IRPG-101 (결정론적 전투 시계 불변식), IRPG-104 (저장 가능한 시드 RNG), IRPG-106 (결정론적 전투 이벤트 스트림)

## Impacts

- Save schema: **none** — `livingCards` 필드는 Schema 10에 이미 존재하고 `persistence.ts`의 모든 마이그레이션 경로가 이미 이월시키고 있다. 이번 티켓은 값만 실제로 채운다.
- Content config: changed — `EnemyDefinition`에 필드 추가(기존 8종은 `capturable: false` 기본값이라 행동 변화 없음).
- Accessibility: none (엔진 전용 변경).

## Acceptance criteria

- Given `capturable: true`인 테스트 픽스처 몬스터를 처치, when `resolveEnemyDefeat`가 실행되면, then `state.livingCards[assetId]`가 생성되고 `captureLoyalty`가 위 결정론적 수식만큼 증가한다.
- Given 동일 시드와 동일 라운드 입력, when 20초 1회 advance와 1초씩 20회 advance를 비교하면, then 최종 `livingCards` 상태가 완전히 동일하다 (IRPG-101 불변식 재사용).
- Given `captureLoyalty`가 100에 도달한 카드, when 같은 개체가 이후 다시 처치되어도, then 값이 100을 넘지 않고 `isCaptured`는 계속 true로 유지된다.
- Given `capturable: false`인 기존 몬스터(현재 8종 전부), when 처치되면, then `state.livingCards`에 어떤 항목도 생성되지 않고 기존 처치·보상·마일스톤 테스트가 그대로 통과한다.
- Given `livingCards` 필드가 없는 구버전 저장 fixture, when 마이그레이션되면, then `{}`로 안전하게 채워지고 이후 정상 누적된다.

## Design

- `captureLoyalty` 계산은 새 RNG draw를 소비하지 않는 순수 함수로 둔다 — 포획 확률에 우연성을 넣고 싶어지더라도, 그 순간 `state.rng`를 소비하면 이후 모든 전투 이벤트의 시드 재현성이 바뀌므로 하지 않는다. 우연성이 필요해지면 별도 티켓에서 전용 RNG 스트림 분리를 먼저 설계한다.
- `species`/`capturable`은 `assetId` 키 lookup 테이블로 관리한다(기존 `ENEMY_ASSET_IDS`/`BOSS_ASSET_IDS` 패턴과 동일한 스타일).

## Verification

- 구현 완료: `types.ts`(`EnemySpecies`, `EnemyDefinition.species`/`capturable`), `content.ts`(`ENEMY_SPECIES_DEFINITIONS` lookup, 현재 8종 전부 `capturable: false`), `engine.ts`(`applyCaptureProgress` + `resolveEnemyDefeat` 연동).
- 수식·불변식 확인:
  - `applyCaptureProgress`는 `state.rng`를 읽거나 쓰지 않음 (코드 리뷰 + `'never consumes an RNG draw'` 테스트로 확인) → IRPG-104/106 시드 재현성 불변식 유지.
  - `captureLoyalty`는 항상 `CAPTURE_LOYALTY_BASE_GAIN`(12) ~ `+HP_BONUS_MAX`(8) 범위로만 증가하고 100에서 클램프, `isCaptured` 도달 후 idempotent.
  - `capturable: false`(현재 실제 8종 전부)는 `livingCards`에 어떤 항목도 만들지 않음 → 기존 밸런스·마일스톤·이벤트 테스트 회귀 없음.
  - `livingCards` 필드는 Schema 10에 이미 존재하고 `persistence.ts`가 이미 모든 마이그레이션 경로에서 이월(기존 `persistence.test.ts:369,461`의 `livingCards: {}` fixture로 이미 커버) → 이번 티켓에서 별도 migration 불필요, 실제로 추가하지 않음.

## Test evidence

- `src/game/engine.test.ts` `describe('IRPG-801 deterministic capture progress', ...)` 8개 케이스 신규 추가(기본 gain, HP 보너스, 결정론, 누적/클램프+isCaptured 전환, capture 이후 idempotent, non-capturable 무영향, RNG 미소비, 실제 8종 로스터로 전체 `advanceGame` 실행 시 `livingCards` 공집합 유지).
- `npm run verify:code` 로컬 실행 결과: lint 통과, typecheck 통과, **Test Files 51 passed / Tests 492 passed**(기존 484 + 신규 8), asset manifest 40 케이스 통과, production build 성공. 회귀 없음.
- 아직 사람 Reviewer 검토 전이라 Status는 `Test`로 두고 `Done` 전환은 Owner/Reviewer 확인 후 진행한다.
