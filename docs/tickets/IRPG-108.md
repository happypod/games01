# IRPG-108 — 첫 동료 협공 전투

## Outcome

첫 보스를 격파한 사용자가 동료를 영입·훈련하고 온라인·오프라인 자동 전투에서 저장 가능한 협공을 확인한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ENG-SIM, ENG-STATE, ENG-SAVE, FE-GAME, GD-BAL, QA-E2E
- Owner / Reviewer: Codex / independent engine, save, accessibility reviewers

## Scope

- 고정 동료 `emberFox` / `불씨 여우 루미` 1명
- 첫 보스 승리(`highestStage >= 11`) 뒤 무료·1회 영입
- 랭크 1~5의 원정 훈련과 골드 비용
- 3초 cooldown의 결정론적 자동 협공
- 협공 횟수·피해의 `AdvanceReport`와 전투·오프라인 UI 표시
- GameState schema2→3 migration, A/B·portable·offline·환생 호환
- 360px·키보드·스크린리더·reduced motion 회귀

## Non-scope

- PvP·서버 대전·친구·길드
- 둘 이상의 동료 동시 편성, 동료 교체·가챠·장비·HP·사망
- 수동 동료 스킬, 별도 RNG·치명타·화염 강타 배율
- 동료 최종 일러스트·animation; 기능 티켓은 CSS·문자 fallback 사용

## Dependencies

- IRPG-104 저장 RNG·치명타
- IRPG-204 첫 환생 30~45분 기준선
- IRPG-303 schema migration·A/B 저장
- IRPG-403 접근성 기준선
- IRPG-505 1x/10x/100x·24시간 soak

## Impacts

- Save schema: migration required, GameState 2→3; envelope format 3 유지
- Content config: fixed companion definition and formulas added
- Accessibility: companion panel, status, cooldown and disabled reason review required

## Acceptance criteria

- Given `highestStage <= 10`일 때, when 동료 영입을 요청하면, then 입력 상태·골드·RNG를 바꾸지 않고 첫 보스 승리 조건을 안내한다.
- Given `highestStage >= 11`이고 미영입일 때, when 영입하면, then `emberFox` rank 1과 cooldown 0이 원자적으로 설정되고 반복 영입은 무변경으로 거부된다.
- Given 준비된 동료와 영웅 공격 뒤 생존한 적일 때, when 한 라운드를 처리하면, then 영웅 뒤 동료가 한 번 공격하고 RNG draw는 라운드당 기존 한 번만 소비한다.
- Given 영웅 또는 동료가 적을 처치할 때, when 사망을 처리하면, then 골드·XP·처치·다음 stage 보상 분기는 정확히 한 번 실행되고 죽은 적은 반격하지 않는다.
- Given 동료가 공격했을 때, when 단일 3초와 1초×3 분할 실행을 비교하면, then cooldown·상태·report·RNG가 정확히 같다.
- Given 훈련 가능할 때, when 훈련하면, then `round(100 × 1.8^(rank - 1))` 골드 차감과 rank 상승이 원자적이며 부족·rank 5에서는 입력 상태를 유지한다.
- Given reload·offline·A/B fallback·portable 왕복일 때, when schema1·2·3 저장을 읽으면, then 영입·rank·cooldown이 보존되고 같은 오프라인 구간의 협공·처치 보상이 재실행되지 않는다.
- Given 영입 뒤 환생할 때, when 환생을 수행하면, then 동료 ID는 유지되고 rank는 1, cooldown은 0으로 초기화되며 미영입 상태는 그대로 유지된다.
- Given 360px·키보드·스크린리더·읽기 전용 탭일 때, when 동료 panel을 탐색하면, then 잠금·영입·훈련·최대·골드 부족 사유와 협공 상태를 이해하고 writer가 아니면 명령할 수 없다.
- Given 기존 비동료 전략과 동료 영입·훈련 전략 각 10개일 때, when 결정론적 밸런스·24시간 soak를 실행하면, then 첫 환생 중앙값 30~45분·모든 세션 60분 내 도달·숫자 불변식·1x/10x/100x 동일성을 유지한다.

## Design

저장 상태는 `player.companion { id: 'emberFox' | null, rank }`와 `battle.companionCooldownMs`다. 미영입은 `null/0`, 영입은 rank 1~5이고 cooldown은 0~3000ms다. 동료 피해는 `round(hero.attack × (0.20 + 0.05 × (rank - 1)))`, 훈련 비용은 `round(100 × 1.8^(rank - 1))`이며 모든 수치는 기존 safe-integer helper로 포화한다.

라운드는 양쪽 cooldown 감소 → 영웅 공격과 기존 RNG 1회 → 적 생존·동료 준비 시 협공 → 공통 사망/보상 분기 → 생존 적 반격 순서다. 영웅이 먼저 처치하면 동료 cooldown을 소비하지 않는다. 동료가 공격하면 3000ms로 설정하며 처치·stage 이동과 수동 stage 선택에서는 유지해 이동 반복 공격을 막는다. 패배·영입·환생은 cooldown을 0으로 초기화한다.

schema3 decoder는 schema2 RNG와 기존 필드를 그대로 유지한 채 미영입 기본값을 추가한다. schema1은 기존 seed migration 뒤 schema3으로 올린다. 기존 최고 stage가 11 이상이어도 소급 자동 영입하거나 골드를 차감하지 않는다. reader는 migration을 메모리에서만 수행하고 writer checkpoint만 A/B revision을 증가시킨다.

## Verification

- 독립 엔진 Review에서 보상 지급 단일 분기, RNG 1 draw, cooldown 경계·치유, 영웅 선처치, 스테이지 이동, 환생, safe integer와 입력 불변을 확인했고 남은 P0/P1/P2가 없다.
- 독립 저장 Review에서 schema1·2·3, envelope v2·3, portable, reader/writer migration, 미래 저장 fence와 mixed-schema revision 동률의 canonical 비교를 확인했고 남은 P0/P1/P2가 없다.
- React 지침과 UI Review에서 영입·훈련 상태, 읽기 전용 사유, 협공 표시, 오프라인 보고, 키보드·스크린리더·360px 흐름에 blocker가 없음을 확인했다.
- 기존 비동료 10세션 중앙값은 1,984.5초, 동료 영입·훈련 10세션 중앙값은 1,865초이며 모두 60분 안에 환생 관문에 도달했다.

## Test evidence

- `engine.test.ts`: 영입 잠금·원자성, 훈련 비용·MAX, RNG 1 draw, 영웅·동료 마무리 일격, 3초 분할 결정론, cooldown 치유·보존, 환생과 MAX_SAFE 회귀 통과.
- `persistence.test.ts`·`saveTransfer.test.ts`: checked-in schema2 fixture, schema1·2→3, format2·3 A/B reader/writer, mixed-schema revision 동률, active companion portable 왕복과 미래 저장 fence 통과.
- `balance.test.ts`: 비동료 10세션 중앙값 1,984.5초, 동료 영입·훈련 10세션 중앙값 1,865초, 20/20 세션 60분 내 도달과 고정 summary·state hash 통과.
- `npm run test:soak`: 1x·10x·100x active rank 5 동료 8시간, 기존·MAX_SAFE 24시간 fixture 포함 6/6 통과.
- `npm run test:coverage`: 12파일 85/85, statements 94.12%, branches 89.81%, functions 100%, lines 95.39%.
- `npm run verify`: ESLint, strict typecheck, 12파일 85/85, production build, Playwright 8/8 통과.
- Playwright: 360px 키보드·스크린리더, 영입→협공→훈련→reload, reader 비활성, 오프라인 협공 1회 정산과 page/console error 0건.
- 구현 head `12ba25444b1107a57221d63653afadc9b82bcb02`의 [push quality-gate](https://github.com/happypod/games01/actions/runs/29630244571)와 [PR quality-gate](https://github.com/happypod/games01/actions/runs/29630246124)가 Install·Chromium·Verify·artifact upload 전체 단계에서 통과했다.
- Playwright report artifact: push `8425221215`(1,586,500 bytes), PR `8425222514`(1,638,290 bytes), 둘 다 2026-08-01 만료이며 해당 head SHA와 일치한다.
