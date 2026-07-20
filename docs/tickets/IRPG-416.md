# IRPG-416 — 동적 전투 연출·비노출 전투 손상

## Outcome

사용자가 선택 2 통합 전술 전장에서 저장과 전투 결과를 바꾸지 않는 호흡·공격·피격·협공·플로팅 수치·필살기 연출과 HP에 따른 안전한 갑옷 손상 변화를 본다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Test
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK, QA-E2E
- Owner / Reviewer: Codex / independent code, art direction, accessibility review

## Scope

- 기존 `combatEventBatch`와 `useTacticalStageEffects` scene을 단일 표시 시계로 재사용하는 영웅 공격, 적 피격, 동료 협공 모션
- 상시 호흡 모션과 영웅·적의 서로 다른 미세한 주기
- 같은 round의 `skill`·`critical` 피해를 중복 표시하지 않는 제한된 플로팅 피해 수치
- 보스전 또는 화염 강타 5랭크 이상에서만 표시되는 비차단형 필살기 암전·불꽃 플래시
- `boss.eclipse-knight`의 기존 Normal 초상과 신규 Damaged·Severe 완전 장갑 전투 손상 초상
- 현재 표시 중인 stage·enemy HP snapshot을 사용한 70%·30% 경계의 순수 presentation selector
- 유형 1과 유형 2에서 같은 전투 손상 selector를 쓰되, 이벤트 모션은 유형 2 전술 전장에 한정
- 360×800, 1024×768, 1440×900, 200% 확대, 모션 감소, lazy-load, asset 실패 검증
- IRPG-506 canonical fixture에 stage 20 Damaged·Severe 상태를 추가하고 기존 baseline 변경 여부를 별도로 비교

## Non-scope

- 노출, 성적 의상 파손, 성적 포즈, 강압적·성적 승패 장면, 혈액·고어
- 게임 엔진, 전투 수식, RNG, 보상, 패배·부활, 동료, 원정 선택 규칙 변경
- `GameState`, A/B slot, portable save schema, revision 또는 migration 변경
- 새 전투 이벤트 종류, 음향, WebGL/canvas API, 프레임 단위 물리 시뮬레이션
- 기존 16:9 승리·패배 결과 일러스트를 1:1 전투 초상으로 교체하는 작업

## Dependencies

- IRPG-106, IRPG-108, IRPG-403, IRPG-410, IRPG-413, IRPG-415, IRPG-506
- 결정론적 전투 이벤트 순서, 제한된 scene queue, 결과 dialog exact-once, asset manifest·lazy fallback 계약

## Impacts

- Save schema / migration / revision: none
- Game engine / formulas / deterministic RNG: none
- Content config: 기본 `EnemyDefinition.assetId`는 유지하고 UI 전용 boss damage variant ID 2개만 추가
- Asset manifest: 고정 inventory 28개에서 30개로 증가, 768×768 WebP·250 KiB 이하·고유 SHA-256·prompt 기록 추가
- Accessibility: 장식 모션과 플로팅 수치는 `aria-hidden`; 기존 전투 로그와 결과 live region이 의미 정보를 계속 담당; 모션 감소에서 transform·flash animation 제거

## Acceptance criteria

- Given 전술 전장이 처음 mount되거나 layout 전환·reload·generation reset이 일어났을 때, when 과거 batch만 존재하면, then 호흡 외의 공격·피격·팝업·필살기 연출을 재생하지 않는다.
- Given 새 `skill` 또는 `critical` scene이 도착했을 때, when 유형 2가 활성화되어 있으면, then 영웅 공격과 적 피격이 scene당 한 번 재생되고 같은 round의 skill·critical 피해는 하나의 primary popup으로 합쳐진다.
- Given 같은 scene에 `companionAssist`가 있을 때, when 협공 피해를 표시하면, then primary 피해와 별도의 동료 popup을 정확히 한 번 표시하고 엔진 수치나 전투 로그를 수정하지 않는다.
- Given boss stage 또는 화염 강타 5랭크 이상에서 새 `skill` scene이 도착했을 때, when 필살기 연출을 표시하면, then 전장만 잠시 어두워지고 스킬 불꽃이 표시되며 명령·focus·전투 진행을 차단하지 않는다.
- Given Eclipse Knight HP가 70% 이상, 30% 이상 70% 미만, 30% 미만일 때, when 전투 초상을 선택하면, then 각각 Normal, Damaged, Severe asset ID가 선택된다. 정확히 70%는 Normal, 정확히 30%는 Damaged다.
- Given `maxHp <= 0`, `NaN`, `Infinity`, 범위를 벗어난 HP 또는 비대상 적일 때, when damage selector를 계산하면, then 기존 기본 asset ID를 반환한다.
- Given outcome event snapshot이 다음 stage의 회복된 적을 가리킬 때, when 결과 scene을 표시하면, then 이전 적의 Severe 상태를 추론하지 않고 snapshot의 stage와 HP를 함께 사용한다.
- Given 신규 damage asset이 누락·decode 실패·지연될 때, when 게임이 계속 진행되면, then 이름·HP·전투·자동 저장·보상은 유지되고 등록된 fallback이 같은 geometry 안에 표시된다.
- Given stage 1 production cold load일 때, when 첫 화면을 연다면, then 신규 boss damage asset 2개를 요청하지 않는다.
- Given `prefers-reduced-motion: reduce`일 때, when 같은 전투 scene을 표시하면, then 호흡·돌진·흔들림·부유·flash animation은 제거되고 정적 cue와 수치는 읽을 수 있다.
- Given 360×800, 1024×768, 1440×900 또는 200% 확대일 때, when Normal·Damaged·Severe 상태와 popup을 확인하면, then 주요 HUD·명령이 가려지거나 가로 overflow가 생기지 않는다.
- Given 기존 IRPG-506 canonical 60개 baseline과 신규 damage fixture를 실행할 때, when hash를 비교하면, then 기존 60개 변경·누락은 0개이고 신규 8개가 추가되어 canonical 68개, 3회 반복 204개가 통과한다.

## Design

Tailwind를 새로 도입하지 않고 기존 `src/styles.css`의 dark-fantasy token과 `.tactical-*` 구조를 확장한다. `useTacticalStageEffects`가 제공하는 900ms scene과 제한 6 queue를 연출 시계로 사용하며 새 저장 상태나 별도 `setTimeout` 전투 시계를 만들지 않는다. CSS trigger는 scene ID 변경 때 표시 요소의 one-shot class만 재시작하고, 장식 DOM은 접근성 트리에서 제외한다.

피해 popup은 `critical`을 우선 primary로 선택하고 그렇지 않으면 `skill`을 사용한다. 두 이벤트가 같은 round에 있으면 엔진이 같은 적용 피해를 표현하므로 두 숫자를 합산하거나 중복 렌더링하지 않는다. `companionAssist`는 별도의 피해이므로 독립 popup을 허용한다. kill·bossVictory·defeat 문구는 기존 cue와 전투 로그가 계속 담당한다.

전투 손상은 저장값이 아닌 렌더 시점의 파생 상태다. 유효 범위의 HP만 `hp / maxHp`로 계산하고 음수·최대 초과·비유한 수치는 Normal로 fail-safe한다. 대상은 완전히 장갑으로 덮인 `boss.eclipse-knight` 하나이며 Damaged는 찌그러진 외부 장갑·균열·그을음, Severe는 더 깊은 균열·약해진 후광을 사용하되 피부 노출·성적 표현·혈액·고어를 포함하지 않는다. `EnemyDefinition.assetId`와 result dialog의 16:9 자산 계약은 유지한다.

## Verification

- Review (2026-07-20): 독립 코드 리뷰에서 outcome snapshot의 다음 적에 이전 hit·defeat·popup이 붙는 P1과 동료 popup이 scene보다 길어 잘리는 P2를 발견해 수정했다. 실제 `advanceGame` kill·bossVictory 회귀와 120ms 종료 여유를 추가한 뒤 재리뷰를 통과했다.
- Review (2026-07-20): 독립 시각 리뷰에서 초안 Damaged의 작은 단계 차이와 Severe 구도 확대를 발견했다. 완전 장갑·비노출·무혈·무고어 조건으로 두 자산을 재생성하고 동일 포즈·카메라·일식 고리·외곽 여백과 작은 슬롯의 단계 구분을 재검수해 P0/P1/P2 없음으로 통과했다.
- Verify (2026-07-20): `npm run verify:code`가 ESLint, strict TypeScript, Vitest 42파일/342개, manifest validator 33개, 자산 30 ID와 production build를 통과했다. GameState·RNG·reward·revision·A/B save schema는 변경하지 않았다.
- Verify (2026-07-20): Normal 원본과 최종 Damaged·Severe 자산 및 1440×900 implementation을 같은 비교 입력에서 확인했고, 기존 HUD·crop·overflow와 단계 전환 구도가 유지됨을 확인했다.
- Verify (2026-07-20): 첫 Ubuntu artifact에서 신규 fixture label 때문에 debug select의 intrinsic width가 달라져 기존 모바일 10개 capture가 1px 재정렬되는 것을 발견했다. 전역 select 폭 보정을 제거하고 신규 label만 기존 최대 폭 안으로 줄인 뒤 영향 범위 Playwright 39/39와 `npm run verify:code`를 다시 통과했다.

## Test evidence

- Local Chromium (2026-07-20): 일반 Playwright 54/54와 production cold-load 5/5 통과. 1440×900, 1024×768, 360×800, effective 360px/200%, reduced-motion, active popup·flash, layout round-trip 비재생과 Type 1·2 damage selector를 포함한다.
- Local visual (2026-07-20): 신규 `visual.dashboard.tactical-damaged`와 `visual.dashboard.tactical-severe`가 각각 4/4 통과했고 기존 tracked 60 PNG 변경·누락 0, 신규 8 PNG만 추가되었다.
- Ubuntu visual (2026-07-20): [run 29714484979](https://github.com/happypod/games01/actions/runs/29714484979)이 canonical 68/68 생성과 같은 runner 3회 반복 204/204를 통과했다. artifact `8450148807`의 digest는 `sha256:7e041d91195b2758518edc30b117af1cc2023b659e36dff3c58377eefbc664c6`이며 내려받은 ZIP hash와 일치한다.
- Baseline acceptance (2026-07-20): artifact와 tracked PNG를 SHA-256으로 비교해 기존 60개 변경·누락 0, 신규 Damaged·Severe 8개만 차이남을 확인하고 그 8개만 Ubuntu canonical로 교체했다. 최종 baseline push/PR quality gate를 확인한 뒤 Done으로 전환한다.
