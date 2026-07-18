# IRPG-104 — 저장 가능한 시드 RNG·결정론적 치명타

## Outcome

같은 저장 상태·시드·경과 시간은 온라인, 오프라인, 분할 실행, 저장 복구 뒤에도 같은 치명타 순서와 최종 상태를 만든다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ENG-SIM, ENG-SAVE, QA-DOMAIN
- Owner / Reviewer: Codex / independent engine and migration reviews

## Scope

- `xorshift32-v1`의 초기 seed, 현재 state, draw 횟수를 `GameState`에 저장
- 전투 라운드마다 정확히 RNG draw 1회를 소비하는 치명타 판정
- 치명타 확률 15%, 피해 배율 1.75배, 화염 강타와 곱한 뒤 최종 피해를 한 번만 반올림
- `AdvanceReport.criticalHits` 집계
- GameState schema v1→v2와 A/B envelope v2→v3을 적용하고 legacy raw·envelope·portable backup을 결정론적으로 migration
- 환생·저장·가져오기·오프라인 정산에서 RNG 연속성 유지

## Non-scope

- 랜덤 장비·드롭, 회피, 적 치명타, 가챠
- 암호학적 난수, 서버 권위 seed, 치명타 전용 애니메이션·이벤트 로그
- 치명타 확률을 올리는 장비·스킬

## Dependencies

- IRPG-101 결정론적 전투 엔진
- IRPG-303 A/B 저장·migration registry
- IRPG-304 portable save decoder
- checked-in `legacy-save-v1.json`

## Impacts

- Save schema: GameState v1→v2, A/B envelope formatVersion v2→v3 migration required; A/B key와 portable exportVersion은 유지
- Content config: critical chance/multiplier added
- Accessibility: none

## Acceptance criteria

- Given 같은 현재 RNG state와 전투 상태일 때, when 같은 총 라운드를 단일·분할 호출로 진행하면, then 치명타 횟수, RNG state·draws, 모든 게임 상태가 같다.
- Given 전투 라운드가 완성될 때, when 기본 공격 또는 화염 강타가 실행되면, then 정확히 draw 1회를 소비하고 `roll < 0.15`일 때만 1.75배를 적용한 뒤 최종 피해를 한 번 반올림한다.
- Given 1초 미만 경과 또는 구매·스테이지 선택·환생 명령일 때, when 명령을 수행하면, then 전투가 아닌 명령은 draw를 추가 소비하지 않으며 환생은 기존 RNG sequence를 보존한다.
- Given schema v1 raw save, schema v1을 포함한 A/B envelope 또는 portable backup일 때, when decode하면, then 저장된 필드만으로 같은 비영(0이 아닌) seed를 생성하고 schema v2로 정규화한다.
- Given 저장·reload·오프라인 bootstrap일 때, when 같은 checkpoint에서 이어서 실행하면, then 중단 없이 실행한 결과와 RNG·치명타·보상·최종 상태가 같다.
- Given 미래 schema 또는 잘못된 RNG algorithm·범위일 때, when decode하거나 저장하면, then 안전하게 거부하고 기존 A/B 원문을 덮어쓰지 않는다.

## Design

RNG는 순수 함수 `nextRandom(rng)`으로만 전진한다. uint32의 0 state는 xorshift 고정점이므로 생성·migration에서 0을 고정 fallback seed로 치환한다. `seed`는 원정의 최초 값, `state`는 다음 draw의 입력, `draws`는 소비 횟수다.

전투 순서는 `쿨다운 갱신 → 화염 강타 여부 → RNG draw/치명타 여부 → attack × skill × critical → 단일 반올림 → 처치/반격`으로 고정한다. 실패 명령과 UI는 RNG를 직접 호출하지 않는다.

v1 migration seed는 시각을 새로 읽지 않고 legacy 상태의 필드를 고정 순서로 직렬화한 FNV-1a 값에서 만든다. 새 writer는 같은 A/B key에 envelope v3만 기록한다. 구버전 writer는 v3를 미래 포맷으로 인식해 덮어쓰지 못하고, 새 reader는 v2/schema1을 읽어 검증 후 v3/schema2로 checkpoint한다. portable parser는 원본 checksum을 먼저 검증한 뒤 migration된 상태의 checksum을 preview에 보관해 commit 직전 재검증을 유지한다.

## Verification

- 독립 엔진 리뷰에서 xorshift32 reference vector, 라운드당 1 draw, 화염 강타×치명타 뒤 단일 반올림, 비전투 명령·환생 RNG 보존을 확인했다.
- 독립 저장 리뷰에서 envelope v3 downgrade fence, raw/A-B/portable v1 migration, canonical checksum, future envelope·state·raw 원문 보존을 확인했다.
- 리뷰가 측정한 10개 seed의 첫 30스테이지 중앙값 약 9분 23초는 RNG 결함이 아니라 기존 밸런스 하한 부재로 분류해 IRPG-204의 필수 튜닝 입력으로 기록했다.

## Test evidence

- `rng.test.ts`, `engine.test.ts`: seed 1 known vector, 999/1000ms 경계, 1 draw/round, 동일 seed·분할 실행, 수식, 비전투 명령·환생 연속성 통과.
- `persistence.test.ts`, `saveTransfer.test.ts`: raw v1, envelope v2/schema1, portable v1 fixture, writer v3 checkpoint, future envelope·state·raw, invalid RNG, reload/offline 연속성 통과.
- `npm run verify`: lint, strict typecheck, Vitest 9파일·54테스트, production build, Playwright 5테스트 통과.
