# IRPG-803 — 2.5D 캠프 오브젝트 캔버스

## Outcome

캠프 "캠프 관리" 탭에 좌표 기반 절대 위치로 시설(텐트/작업대/단련소)과 세라를 배치하는 조감도 뷰를 추가해, 기존 카드 나열형 UI와 병행 제공한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Test
- Skill tags: FE-GAME, UX-FEEDBACK, A11Y, ART-2D, QA-E2E
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- `src/components/CampCanvas.tsx` (신규): `CampDashboard.tsx`의 `overview` 탭 안에 "조감도 보기" 토글로 추가한다.
  - 배경 위에 tent/workbench/trainingGround를 퍼센트 좌표(`{ x, y }`)로 절대 배치한다. 좌표는 이 컴포넌트 안의 상수 테이블로 관리한다(엔진 상태에 좌표를 저장하지 않는다 — 순수 프레젠테이션).
  - 세라가 `status !== 'unmet'`이면 캠프 내 지정 위치에 액터로 표시한다.
  - 각 오브젝트/액터는 **실제 `<button>` 엘리먼트**로 렌더링한다(`<div onClick>` 금지) — 별도의 roving-tabindex 구현 없이 네이티브 키보드 포커스·Enter/Space 활성화를 확보하기 위함.
  - 오브젝트 활성화 시 **새 명령을 만들지 않고** 기존 `CampDashboard`의 `activateCenterTab`/`onUpgradeStructure` 등 기존 핸들러와 상태(레벨, 비용, disabled 사유)를 그대로 재사용해 해당 카드로 포커스를 이동하거나 관련 탭을 연다.
  - 시설 아트는 기존 `GameAsset` 컴포넌트(purpose="card", fallbackLabel 포함)를 재사용해 자산 누락 시 기존 fallback 규약을 그대로 따른다.
- `src/styles.css`: Tailwind 없이 순수 CSS로 `camp-canvas`, `camp-canvas__object`, `camp-canvas__actor` 등 BEM 스타일 클래스를 추가한다. `prefers-reduced-motion`에서 hover/등장 애니메이션을 비활성화한다(기존 IRPG-403 패턴).
- `src/components/CampCanvas.test.tsx` / e2e: 렌더링·키보드 활성화·360px 레이아웃 테스트를 추가한다.
- `tools/run-visual-regression.mjs` 대상에 조감도 뷰의 새 시각 상태 baseline을 추가한다(IRPG-506 harness 확장).

## Non-scope

- Drag & Drop 배치, 액터를 오브젝트로 끌어다 놓는 인터랙션 (Wartales 스타일 전체 구현 아님, 1단계는 클릭/키보드 활성화만)
- 신규 배경·오브젝트 스프라이트 아트 제작 (기존 GameAsset fallback 사용)
- 포획한 몬스터/생체카드 액터의 캠프 내 배치 (IRPG-801/802 이후, IRPG-804에서 재검토)
- 기존 `camp-facility-grid` 카드형 UI 제거 — 이번 티켓은 토글 병행 추가만 다루고, 전면 교체는 별도 후속 티켓에서 사용성 데이터를 본 뒤 결정한다.

## Dependencies

- IRPG-419 (캠프 시설·영구 훈련·오프라인 상한), IRPG-424 (전술 정보 레일·8슬롯 명령 재배치), IRPG-425 (CHAPTER I 유대 시설), IRPG-403 (접근성·모바일 감사), IRPG-506 (시각 브라우저 회귀 게이트)

## Impacts

- Save schema: none (좌표는 컴포넌트 상수, 저장 상태 아님)
- Content config: none (기존 `CampState`/`CampResidentState` 그대로 사용)
- Accessibility: review 필요 — 신규 인터랙티브 오브젝트의 키보드 포커스 순서·aria-label·모션 감소 대응

## Acceptance criteria

- Given 캠프 모드에서 "조감도 보기"로 전환, when 화면을 열면, then tent/workbench/trainingGround가 배경 위 절대 좌표(%)에 렌더링된다.
- Given tent 오브젝트를 클릭 또는 Enter로 활성화, when 실행되면, then 기존 `onUpgradeStructure` 핸들러가 그대로 호출되고 레벨/비용/비활성 상태가 카드형 UI와 완전히 동일하게 반영된다(새 로직 없음).
- Given 세라 상태가 `rescued` 이상, when 조감도를 보면, then 세라 액터가 표시되고 활성화 시 기존 "유대 훈련실" 탭이 열린다. Given `unmet` 상태면, then 액터가 표시되지 않는다.
- Given 키보드 사용자, when Tab으로 순회하면, then 모든 오브젝트가 포커스 가능한 `<button>`이고 Tab 순서가 논리적이며 가로 스크롤 없이 전체가 보인다(360px 포함).
- Given `prefers-reduced-motion: reduce`, when 오브젝트에 hover/등장 효과가 있으면, then 해당 애니메이션이 비활성화된다.
- Given 기존 `camp-facility-grid`, when 이 티켓이 완료되어도, then 카드형 UI는 삭제되지 않고 토글로 공존한다.

## Design

- 좌표·인터랙션은 순수 프레젠테이션 레이어로 한정하고, 모든 게임 로직(비용 계산, disabled 조건, 접근성 문구)은 `CampDashboard.tsx`가 이미 계산해 둔 값과 핸들러를 그대로 전달받아 재사용한다 — 이 티켓에서 새 engine 명령이나 새 상태 필드를 만들지 않는다.
- **Raid: Shadow Legends 마을 화면 참조(사용자 제공 스크린샷)** — 구체적으로 재현할 패턴:
  - 건물마다 (a) 건물 위에 떠 있는 작은 원형 상태 배지(레벨/상호작용 가능 표시), (b) 배지 아래 어두운 반투명 알약형 라벨에 "이름 · Lv.N" 텍스트. `CampCanvas.tsx` 오브젝트 마크업이 이 두 레이어(배지+라벨)를 그대로 따른다.
  - 상단 자원 바(에너지/골드/보석에 해당)는 Emberwatch에 이미 `topbar`의 `resource-rack`(골드/불씨 정수 칩)로 동일 패턴이 있음 — 캠프 캔버스 전용으로 새로 만들지 않고 기존 topbar를 그대로 유지한다.
  - 화면 우하단에 무게감 있는 단일 원색 CTA 버튼(스크린샷의 붉은 "전투" 버튼)이 있는데, Emberwatch는 이미 `GameModeSelector`가 이 역할을 하므로 새 버튼을 만들지 않고 시각적 강조만 참고한다.
  - 하단 원형 아이콘 네비게이션 열은 이번 티켓 범위 밖(`TacticalUtilityDock`이 전투 화면에서 이미 유사한 원형 아이콘 도크 패턴을 사용 중 — 필요하면 후속 티켓에서 캠프 쪽에도 통일 검토).
- 참고만 하고 이번 티켓에서 만들지 않는 것: 레벨업 대사창(VN 스타일 승리 연출)과 챔피언 장비창 3단 컬럼 레이아웃 — 각각 별도 스크린샷 참조 대상이며, 전자는 800~804에 없는 새 범위, 후자는 이미 Done인 IRPG-703을 재작업하는 것이라 별도 티켓 논의가 필요하다(Owner 확인 대기).

## Verification

- 구현 완료: `src/components/CampCanvas.tsx` 신규 — tent/workbench/trainingGround을 실제 `<button>`으로 절대 좌표(%) 배치하고 `onUpgradeStructure(facility.id)`를 그대로 호출, 레벨/비용/비활성(`isMax`/`cannotAfford`) 계산은 `CampDashboard.tsx`의 카드형 UI와 동일한 `getCampStructureUpgradeCost` 호출로 100% 동일하게 파생(중복 계산 없음).
- 시설 정의(`FACILITIES`)는 react-refresh 규칙 위반을 피하기 위해 `CampDashboard.tsx`에서 `src/game/camp.ts`의 `CAMP_FACILITY_DEFINITIONS`로 옮겨 카드형 UI와 캔버스가 단일 정의를 공유하도록 리팩터링.
- `CampDashboard.tsx`에 `campViewMode`('cards'|'canvas') 토글 추가 — 기본값은 `'cards'`라 기존 회귀 없음. 캔버스 모드에서만 세라 액터가 대체되므로 기존 `camp-resident` 카드 섹션은 `campViewMode === 'cards'`일 때만 렌더링.
- 세라 액터는 `sera.status !== 'unmet'`일 때만 표시되고, 아직 동의/의상 등 유대 시스템 관련 자산은 사용하지 않음(`character.sera.camp-default`라는 미등록 placeholder assetId → GameAsset 폴백 텍스트 "세라"만 표시 — 합의되지 않은 유대 자산을 캠프 조감도에 노출하지 않기 위한 의도적 선택).
- **실브라우저 수동 확인**: `npm run dev`로 실행해 캠프 모드 진입 → "조감도 보기" 클릭 → 텐트/작업대/단련소 3개 버튼이 올바른 레벨·비용·골드부족 상태로 렌더링되고 카드형 UI와 동일한 aria-label을 보임을 확인. 토글이 "카드 보기"로 바뀌고 재클릭 시 원래 카드 그리드로 복귀함을 확인. 신규 세이브는 세라가 `unmet` 상태라 캔버스에 세라 액터가 나타나지 않음을 확인(자동 테스트로 rescued 상태 케이스는 별도 커버).

## Test evidence

- `src/components/CampCanvas.test.tsx` 6개 케이스(오브젝트 렌더링, 실제 핸들러 호출, 카드 UI와 동일한 비활성화 조건, 공용 disabled 전파, 세라 unmet 시 숨김, 세라 rescued 시 표시+콜백 호출).
- `npm run verify:code` 로컬 실행 결과: lint/typecheck 통과, **Test Files 53 passed / Tests 504 passed**(IRPG-802 이후 498 + 신규 6), asset manifest 40 케이스, production build 성공. 회귀 없음.
- 실브라우저 수동 검증(위 Verification 참고) — `npm run test:e2e:visual`(Ubuntu 기준 회귀)과 Playwright e2e는 이 프로젝트 컨벤션상 로컬 Windows에서 신뢰할 수 없어 실행하지 않음(CI에서 확인 필요).
- 아직 사람 Reviewer 검토 전이라 Status는 `Test`로 두고 `Done` 전환은 Owner/Reviewer 확인 후 진행한다.
