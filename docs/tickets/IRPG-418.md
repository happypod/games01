# IRPG-418 — 전투·캠프 전환과 손실 없는 오프라인 원정

## Outcome

사용자가 전투 화면과 캠프 관리 화면을 즉시 전환하고, 캠프를 보고 있는 동안 전경 전투는 멈추지만 재접속 시 마지막 전투 상태부터 기존 자동 원정을 정확히 한 번 정산한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Test
- Skill tags: ENG-STATE, ENG-SAVE, FE-GAME, QA-DOMAIN, QA-E2E
- Owner / Reviewer: Codex / independent domain and accessibility review

## Scope

- `GameState` schema 6에 `currentMode: 'BATTLE' | 'CAMP'`와 versioned `camp` 기반 상태를 추가한다.
- schema 5→6은 모든 캠프 필드를 안전한 비활성 기본값으로만 채우며 과거 진행에 재료·시설·계약·보상을 소급하지 않는다.
- 캠프 전경 pulse는 전투 라운드·RNG·보상·스테이지·전투 이벤트를 진행하지 않는다.
- writer autosave는 캠프에서도 `lastSavedAt`을 갱신해 온라인 캠프 시간을 다음 재접속에서 중복 정산하지 않는다.
- writer bootstrap은 저장된 모드와 관계없이 마지막 전투 HP·stage·cooldown·remainder에서 기존 자동 원정 규칙을 오프라인 상한까지 한 번 적용한 뒤 원래 캠프 모드를 복원한다.
- 전투/캠프 선택기와 휴식 상태·마지막 전투 stage를 보여 주는 접근 가능한 캠프 기본 화면을 추가한다.
- A/B envelope format 3, slot key, portable export version 1은 유지한다.

## Non-scope

- 시설 효과·훈련·재료 드롭·제작·버프·상인·구조·계약 효과 활성화
- 고정 stage 반복 파밍, 안전 파밍 stage, 서버 시간, 계정·클라우드 저장
- 포획·소유·노예·강압·성적 조교·노골적 성적 보상
- 랜덤 장비·등급·옵션·아이템 인스턴스와 여러 전투 동료 동시 편성

## Dependencies

- IRPG-302, IRPG-303, IRPG-304, IRPG-305, IRPG-403, IRPG-414, IRPG-415, IRPG-417, IRPG-504, IRPG-506
- schema5 원정 ledger, A/B revision, 단일 writer, 비영속 전투 event stream 계약

## Impacts

- Save schema: schema 5→6 migration required; A/B envelope·portable outer format compatible
- Content config: 캠프 definition v1의 안전한 기본값 추가
- Accessibility: mode radiogroup, 44px 조작, 단일 활성 surface, 캠프 정지 상태의 텍스트 설명 검토

## Acceptance criteria

- Given 전투 상태일 때, when 캠프 진입 명령이 성공하면, then mode만 한 revision으로 저장되고 HP·enemy HP·stage·remainder·cooldown·RNG·재화는 변하지 않는다.
- Given 캠프 상태일 때, when 5초 이상 writer pulse와 autosave가 지나면, then 전투 rounds·RNG draws·보상·event cursor는 증가하지 않고 `lastSavedAt`만 현재화된다.
- Given 캠프에서 저장 후 1분 이상 앱을 닫았을 때, when writer bootstrap을 한 번 수행하면, then 마지막 전투 상태부터 온라인과 같은 결정론적 결과가 한 번 적용되고 최종 mode는 `CAMP`다.
- Given 같은 `now`로 다시 bootstrap할 때, then 두 번째 오프라인 보고나 보상은 없다.
- Given 같은 상태·seed·경과 시간일 때, when 단일 오프라인 정산과 분할 온라인 전투를 비교하면, then 캠프 mode를 제외한 전투 상태·RNG·보상 결과가 같다.
- Given schema5 raw/A/B/portable 저장일 때, when 읽으면, then schema6 기본 캠프로 무소급 migration되고 reader는 쓰지 않으며 writer만 revision+1 checkpoint를 기록한다.
- Given malformed 또는 future camp definition/schema일 때, when bootstrap/import하면, then 원문을 덮어쓰지 않고 기존 future fence 계약대로 차단한다.
- Given 360×800·1440×900·200% 확대·키보드·모션 감소 환경일 때, when 전투↔캠프를 왕복하면, then 단일 surface만 존재하고 가로 overflow·가려진 조작·지속 전환 모션이 없다.

## Design

`advanceGame`은 전경 모드 규칙을 지키고, bootstrap 전용 `advanceOfflineGame`은 clone한 상태를 전투 모드로 정산한 뒤 입력 mode를 복원한다. 캠프에서 보낸 온라인 시간은 250ms pulse가 전투 없이 checkpoint하므로 오프라인 구간으로 다시 계산되지 않는다. “마지막 전투에서 자동 파밍”은 별도 고정 파밍 규칙이 아니라 저장된 exact battle snapshot에서 현재 자동 원정을 재개한다.

schema6의 `camp`는 IRPG-419~421에서 사용할 finite ID record를 미리 안전한 기본값으로 예약한다. 현재 티켓에서는 이 필드가 전투 수식·RNG·보상에 영향을 주지 않는다. 환생은 캠프 기반 상태를 보존하되 활성 전투 mode는 `BATTLE`로 복귀한다.

## Verification

- 구현 전 state·offline·A/B·portable·combat event 경계를 검토했다.
- 구현 계약은 [제품 명세](../PRODUCT.md)의 활동 모드·오프라인 규칙, [아키텍처](../ARCHITECTURE.md)의 schema6·순수 전이·future fence, [테스트 계획](../TEST_PLAN.md)의 exact-once·반응형·접근성 게이트에 반영했다.
- 코드에 `SAVE_VERSION = 6`, `createInitialCampState`, `switchGameMode`, `advanceOfflineGame`, camp decoder/future fence와 전투·캠프 단일 surface가 존재하는지 확인했다.
- Review: 독립 domain·save·accessibility 리뷰를 완료했고 malformed resident status, 훈련 상한, 명령 전 elapsed 정산, keyboard roving focus 지적을 반영했다.
- Verify: schema5→6 무소급 migration, camp future fence, 전경 전투 정지, CAMP offline exact-once와 mode 복원, 360px·200%·reduced-motion 수용 기준을 코드·문서·테스트에 매핑했다.
- Test: 로컬 code·browser gate는 통과했고 Ubuntu canonical 4종과 같은 최종 SHA의 push·PR quality gate를 기다린다.

## Test evidence

- 작성된 단위 증거: `src/game/campMode.test.ts` — mode-only 전환, 60초 전경 정지, offline normal-engine 동치·mode 복원, 환생 경계.
- 작성된 저장 증거: `src/game/campPersistence.test.ts` — schema5→6 무소급 migration, reader 무쓰기·writer revision checkpoint, 캠프 offline exact-once, future camp definition 분류.
- 작성된 브라우저 증거: `e2e/camp.spec.ts` — 캠프 6초 전경 정지, 페이지 종료 후 1분 offline 정산, 같은 시각 reload 무중복, 전투 복귀, 360×800 키보드·44px·overflow·reduced-motion.
- 로컬 증거: Vitest 47 files·395 tests, ESLint, TypeScript, production build, manifest 33 tests·30 IDs, 일반 Playwright 60 tests, production cold-load 5 tests를 통과했다. 시간 경계 수정 뒤 캠프 수용 흐름은 CI와 같은 단일 worker에서 5/5 재통과했다.
- CI 결과: Ubuntu canonical과 최종 quality gate가 pending이므로 아직 Done 처리하지 않는다.
