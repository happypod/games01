# IRPG-424 — 전술 정보 레일·8슬롯 명령 재배치

## Outcome

사용자가 하단 8슬롯에서 모든 성장·동료·회복 명령을 실행하고, 우측 전술 정보 레일에서 현재 적·지도·캐릭터·가방·스킬·도감을 중복 없이 확인한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Verify
- Skill tags: FE-GAME, UX-FEEDBACK, A11Y, QA-E2E, REL-CI
- Owner / Reviewer: Codex / independent React, accessibility and visual review

## Scope

- 우측 `GrowthTabs`를 현재 적 고정 요약과 `지도·캐릭터·가방·스킬·도감` 탭의 전술 정보 레일로 교체한다.
- 하단 8슬롯을 장비 3·스킬 3·동료 1·빠른 소모품 1로 재구성한다.
- 장비·스킬 강화, 동료 영입·훈련, 장착된 회복 물약 사용의 실행 명령은 하단 슬롯만 소유한다.
- 가방 탭에서 재료·황금 스튜·집중 물약·회복 물약과 활성 보급 상태를 보여 주고 회복 물약을 빠른 슬롯에 장착한다.
- 지도는 현재 지역 10단계와 전체 3지역 오버레이 진입을 제공하고, 도감은 `highestStage`와 고정 적 배치로 해금을 파생한다.
- 기존 전투 로그·승패 결과·불씨의 계승·저장 백업 유틸리티 도크는 정보 레일 하단에 유지한다.

## Non-scope

- 랜덤 장비·장비 instance·정렬·필터·종별 처치 원장
- 둘 이상의 빠른 소모품 슬롯·사용자 정의 단축키
- 전투 수식·RNG·보상·환생 수식
- 신규 일러스트 생성

## Dependencies

- IRPG-423 완료
- IRPG-403, IRPG-408, IRPG-409, IRPG-413, IRPG-422, IRPG-506
- 기존 `TacticalStage`, `StageMapPanel`, `TacticalUtilityDock`, manifest resolver

## Impacts

- Save schema: IRPG-423 schema7 필드만 소비, 추가 migration 없음
- Content config: 기존 적·장비·스킬·동료 정의에서 view model 파생
- Accessibility: tab/tabpanel roving focus, 44px target, live HP 비공지, 360px 읽기 순서 검토
- Visual: 전투 fixture baseline 의도적 변경

## Acceptance criteria

- Given 전투 화면일 때, then 우측에는 성장 센터가 없고 현재 적 요약과 지도·캐릭터·가방·스킬·도감 중 한 tabpanel만 표시된다.
- Given 하단 슬롯바일 때, then 장비 3·스킬 3·동료 1·빠른 소모품 1이 정확한 순서로 표시되고 각 mutation 명령은 한 진입점에서만 실행된다.
- Given 동료 미영입·영입 가능·훈련 가능·골드 부족일 때, when 동료 슬롯을 사용하면, then 기존 영입·훈련 계약과 사유를 보존한다.
- Given 가방 탭의 회복 물약일 때, when 장착·해제를 선택하면, then 빠른 슬롯 상태가 즉시 갱신되고 reload·offline·portable 복원 뒤 유지된다.
- Given 지도 탭일 때, then 현재 지역 10단계의 완료·현재·잠김·보스 상태와 전체 지도 열기가 기존 `selectStage` 계약을 재사용한다.
- Given 도감 탭일 때, then 최고 도달 스테이지 이전에 만난 적·보스만 공개하고 미발견 항목은 저장 필드 없이 가린다.
- Given 360×800, 1024×768, 1440×900, effective 360px/200%와 reduced motion일 때, then 전장→슬롯바→정보 레일 순서를 유지하고 페이지 가로 overflow가 없다.
- Given 키보드 사용자일 때, when 탭에서 Arrow/Home/End를 사용하면, then 단일 roving tab stop과 활성 tabpanel·명확한 accessible name을 유지한다.

## Design

현재 적은 전투 판단의 기본 정보이므로 탭 밖에 고정한다. 다섯 탭은 조회 중심이며 가방의 장착만 예외 mutation으로 둔다. 장비·스킬·동료 성장과 전투 아이템 사용은 `TacticalActionBar`의 상세 surface에서만 실행해 우측 성장 센터의 중복 명령을 제거한다. 도감 발견 여부는 1부터 `highestStage`까지의 고정 enemy definition에서 파생해 새 저장 원장을 만들지 않는다.

1024px 이상에서는 정보 레일 본문만 스크롤하고 유틸리티 도크를 하단에 고정한다. 900px 이하에서는 활성 패널 하나만 전장 아래로 쌓고 탭을 가로 스크롤 또는 균등 grid로 배치한다. HP 변화는 시각적으로 갱신하되 매 라운드 live announcement를 만들지 않는다.

## Verification

- 기존 화면 캡처 감사: 우측 성장 센터가 하단 장비·스킬 슬롯과 명령을 중복하고 좁은 폭에서 핵심 전장보다 높은 시각 밀도를 차지함을 확인했다.
- 독립 React·접근성·반응형 리뷰에서 P0/P1은 없었고, 모바일에서 빠른 슬롯의 `인벤토리 열기`가 가방 탭을 선택해도 viewport가 따라오지 않던 P2를 focus·scroll 연동과 360px 회귀로 수정했다.
- 데스크톱·태블릿·360px·200%·reduced-motion 브라우저 비교에서 전장→8슬롯→전술 정보 레일 순서, 가로 overflow 없음, roving tab과 44px 조작을 확인했다.
- Windows 로컬 canonical 명령은 계약대로 skip됐다. 변경된 전투 fixture 18개 × 4 variant의 Ubuntu `72/72`, 3회 반복 `216/216`, artifact 수동 diff 검토가 남아 있어 Done이 아닌 Verify로 유지한다.

## Test evidence

- `TacticalActionBar.test.tsx`, `TacticalIntelPanel.test.tsx`, `GameScreen.test.tsx`와 dashboard·accessibility·cards·layout·map·save Playwright에 8슬롯, 5탭, 가방 연결, 키보드·반응형 수용 기준을 고정했다.
- 2026-07-22 최종 `npm run verify`에서 일반 Playwright `62/62`, production asset Playwright `5/5`, Vitest `49파일/432개`, manifest validator `33/33`, production manifest `30 ID`, lint·typecheck·build가 통과했다.
- `npm run test:e2e:visual`은 `[IRPG-506] Canonical screenshot comparison runs on Ubuntu GitHub Actions; local comparison skipped.`로 정상 종료했다. Ubuntu canonical artifact와 실제 보조공학 감사는 Verify 잔여 증거다.
