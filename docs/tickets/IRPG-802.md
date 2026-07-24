# IRPG-802 — LivingCardConsole 실데이터 연동

## Outcome

`LivingCardConsole.tsx`가 클라이언트에서 즉석으로 지어낸 포획/타락 수치와 하드코딩된 가짜 전투 로그 대신, IRPG-801에서 실제로 채워지는 `state.livingCards`와 실제 전투 이벤트 배치만을 표시한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Test
- Skill tags: FE-GAME, UX-FEEDBACK, QA-DOMAIN
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- `src/components/LivingCardConsole.tsx`를 다음과 같이 수정한다.
  - `currentCardState`를 `enemyHpRatio`/`state.battle.stage`로부터 즉석 계산하는 현재 로직을 제거하고, `state.livingCards[enemy.assetId]`가 존재할 때만 포획 카드 섹션을 렌더링한다. 존재하지 않으면(비-capturable 몬스터이거나 아직 포획 진행이 없는 경우) 포획 관련 수치 대신 빈 상태(empty state) 문구를 보여준다.
  - "LIVE COMBAT LOGS" 섹션의 하드코딩된 5줄 로그(`영웅 아렌이 ... 피해를 입혔습니다` 등)를 제거하고, `game.combatEventBatch`(이미 `GameScreen.tsx`에서 사용 중인 실제 이벤트 배치)에서 최근 이벤트를 매핑해 표시한다.
  - 잘못된 하드코딩 문구 `Schema 5 전투 세션 진행 중...`을 제거한다(실제 스키마 버전이 필요하면 `SAVE_VERSION` import).
  - `hStage`/`damageStage` 표시는 IRPG-801에서 추가된 `getActorDamageStage`류 헬퍼 또는 `state.livingCards[...].hStage` 값을 그대로 사용하고 중복 계산하지 않는다.
- `src/components/LivingCardConsole.test.tsx`(신규): 빈 상태, capturable 카드 존재 상태, 실제 로그 매핑을 검증하는 테스트를 추가한다.

## Non-scope

- `state.livingCards`를 실제로 채우는 엔진 로직 자체 (IRPG-801, 선행 필요)
- 포획한 개체를 캠프에서 동료화/크래프팅/교배에 사용하는 인터랙션 (IRPG-804)
- 2.5D 캠프 캔버스 배치 (IRPG-803) — 이 티켓은 현재 전술 정보 독(dock) 안 콘솔 형태를 유지한다.

## Dependencies

- IRPG-801 (결정론적 포획 엔진 — `livingCards`가 실제 값을 가져야 이 티켓의 "실데이터 연동"이 검증 가능)

## Impacts

- Save schema: none
- Content config: none
- Accessibility: review 필요 — 포획 카드 섹션과 로그 섹션 모두 `aria-live`/역할(role) 적절성 확인 (현재 컴포넌트 바깥 wrapper에 `pointerEvents: 'none'`이 걸려 있어 스크린리더·키보드 접근성에 영향이 없는지 함께 점검한다).

## Acceptance criteria

- Given `state.livingCards`에 항목이 없는 상태(포획 대상이 없거나 진행 전), when `LivingCardConsole`이 렌더링되면, then 포획 복종도/타락 농도는 표시되지 않거나 명시적 빈 상태로만 표시되고 클라이언트에서 값을 계산하지 않는다.
- Given `state.livingCards`에 실제 항목이 있으면, when 렌더링되면, then 표시되는 `captureLoyalty`/`corruptionLevel`/`isCaptured`가 엔진 상태값과 정확히 일치한다.
- Given 실제 전투 이벤트 배치, when 로그 섹션이 렌더링되면, then 하드코딩 문자열이 아니라 최근 이벤트 N개가 실제 이벤트 타입·수치로 표시된다.
- Given 코드 전체, when 검색하면, then `Schema 5`라는 하드코딩 문자열이나 존재하지 않는 실제 상태 기반이 아닌 가짜 수치 계산식이 더 이상 존재하지 않는다.

## Design

- 이 컴포넌트는 삭제하지 않는다 — IRPG-800/804 로드맵에서 향후 포획 개체 상태를 보여주는 상시 콘솔로 계속 쓰인다. 이번 티켓은 "가짜 데이터를 실제 데이터로 교체"까지만 다룬다.

## Verification

- 구현 완료: `LivingCardConsole.tsx`에서 `enemyHpRatio`/`state.battle.stage` 기반 즉석 계산을 제거하고 `state.livingCards[enemy.assetId]`가 있을 때만 표시, 없으면 명시적 빈 상태(`포획 진행 중인 대상이 없습니다`)로 렌더링하도록 변경.
- 로그 섹션은 하드코딩 5줄 대신 `CombatEventBatch`를 실제로 매핑한다. 포맷터 중복을 피하기 위해 `CombatLogPanel.tsx`가 갖고 있던 `getEventCopy`/`safeNumber`/`safeString`을 `combatLogView.ts`(로직 전용 모듈)로 옮기고 두 컴포넌트가 동일 함수를 공유하도록 리팩터링(부수 효과: `CombatLogPanel.tsx`가 다시 컴포넌트만 export하게 되어 react-refresh lint 규칙도 만족).
- `Schema 5` 하드코딩 문구, 존재하지 않는 데이터 기반 전투 로그 5줄을 전부 제거함을 코드로 확인.
- 불필요했던 바깥 wrapper `pointerEvents: 'none'`(및 대응하는 개별 `pointerEvents: 'auto'`)도 함께 제거 — 이 콘솔은 오버레이가 아니라 `tactical-command-dock` 안에 인라인으로 배치되어 있어 클릭 통과가 필요 없었다.

## Test evidence

- `src/components/LivingCardConsole.test.tsx` 6개 케이스(빈 상태, 실제 카드 값 표시, 포획 배지, 실제 로그 텍스트, 로그 빈 상태, 구 하드코딩 문구 부재).
- `npm run verify:code` 로컬 실행 결과: lint/typecheck 통과, **Test Files 52 passed / Tests 498 passed**(IRPG-801 이후 492 + 신규 6), asset manifest 40 케이스, production build 성공. 회귀 없음.
- 아직 사람 Reviewer 검토 전이라 Status는 `Test`로 두고 `Done` 전환은 Owner/Reviewer 확인 후 진행한다.
