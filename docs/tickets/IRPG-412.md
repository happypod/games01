# IRPG-412 — 원정 선택 이벤트 카드 UI

## Outcome

저장된 pending 원정 이벤트를 최대 3개 카드로 확인하고 keyboard·pointer로 선택해 효과를 정확히 한 번 적용한다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Test
- Skill tags: ART-2D, FE-GAME, ENG-STATE, UX-FEEDBACK
- Owner / Reviewer: unassigned / frontend, save, and accessibility reviewers

## Scope

- IRPG-107 pending event 최대 3개의 일러스트 카드
- `event.ember-shrine`·`event.wandering-smith`·`event.ash-camp` 자산과 card fallback
- 선택지 효과 preview, 성공·실패·이미 완료 상태
- keyboard·pointer 명령과 focus 유지
- 이미지·metadata fallback

## Non-scope

- 전투 로그, 서버 라이브 이벤트, 퀘스트·시즌
- UI 직접 보상·재계산, 강제 modal·전투 정지
- pending event 생성·migration 규칙

## Dependencies

- IRPG-107 결정론적 원정 선택 이벤트
- IRPG-403 접근성 기준선
- IRPG-406 asset manifest
- IRPG-409 card language
- IRPG-506 visual regression harness

## Impacts

- Save schema: none beyond IRPG-107
- Content config: expedition event presentation metadata
- Accessibility: choice group, focus, status announcement review required

## Acceptance criteria

- Given pending event 0~3개일 때, when UI를 렌더링하면, then event ID·이미지·선택지·효과 preview와 빈 상태가 저장 상태와 일치한다.
- Given 선택 가능한 카드일 때, when keyboard·pointer로 선택하면, then IRPG-107 명령을 한 번 호출하고 성공·실패 이유를 표시한다.
- Given double click·rerender·reload일 때, when 같은 event를 다시 선택하면, then 완료된 ID는 재지급되지 않고 카드가 최신 pending 상태로 갱신된다.
- Given 선택 성공으로 현재 카드가 제거될 때, when focus를 복원하면, then 다음 pending 카드의 첫 선택지로 이동하고 pending이 없으면 원정 이벤트 section heading 또는 focus 가능한 empty state로 이동한다; 실패하면 누른 선택지에 focus를 유지한다.
- Given 이미지 실패·360px·200% 확대·스크린리더일 때, when 카드를 순회하면, then 텍스트 fallback·선택 관계·focus 순서가 유지되고 전투는 계속된다.

## Design

카드는 저장 상태의 view이며 효과를 계산하거나 지급하지 않는다. 선택 성공 뒤 engine이 반환한 새 상태를 표시하고 focus는 다음 pending 카드의 첫 선택지, 없으면 section heading/empty state로 보낸다. 거부된 명령은 원래 선택지에 focus를 유지하고 이유를 연결한다. 대기 중에도 자동 전투 tick을 막지 않는다.

## Approved implementation contract (2026-07-19)

- 카드와 선택지는 저장된 pending 배열 및 `resolvedChoices` 순서를 그대로 사용한다. 이름·설명·선택 문구·asset ID는 pending의 `definitionVersion`에 맞는 immutable registry에서 읽고, 보상 type·amount는 저장된 resolved effect만 `골드 최대 +N` 또는 `체력 최대 +N`으로 표시한다. 현재 콘텐츠 수식으로 효과를 다시 계산하지 않는다.
- 화면 순서는 section heading `원정 선택 이벤트`, `대기 중 N/3`, 오래된 pending 카드 순이다. 각 카드는 `스테이지 N에서 발견`, 이름, 설명, 고유 일러스트와 두 native button을 갖는다. 공통 문구 `보유 한도와 현재 체력에 따라 실제 증가량은 줄어들 수 있습니다.`를 표시한다. canonical event ID는 DOM key와 `data-expedition-event-id`에만 사용하고 접근성 이름으로 읽지 않는다.
- UI callback은 `{ success, message, reason }`을 동기로 반환한다. reason은 `committed | rejected | read-only | save-failed`이며 `committed`는 A/B write·read-back이 성공하고 메모리 commit까지 끝난 뒤에만 반환한다. 저장 실패에는 optimistic 카드 제거·성공 표시를 하지 않는다.
- 첫 입력 handler 진입 전에 event ID를 ref로 잠근다. 같은 이벤트의 rapid pointer·Enter·Space 후속 입력은 engine callback 전 차단하고 notice를 덮어쓰지 않는다. 거절되면 잠금을 풀고, 성공하면 pending에서 제거될 때까지 유지한다.
- 완료 상태는 새 저장 ledger가 아니라 카드 제거와 기존 전역 polite notice의 일시적 피드백으로 한정한다. reload 뒤 완료 이력 카드를 재구성하지 않는다. 엔진 거절은 누른 버튼에 focus를 유지한다. 성공 뒤에는 제거된 index를 새 pending 길이로 순환한 카드의 첫 선택지로 이동하고, 남은 카드가 없으면 `tabIndex=-1`인 section heading으로 이동한다. 저장 실패·reader snapshot 교체로 대상이 사라지면 남은 카드 또는 section heading으로 안전하게 복원한다. 자동 생성된 새 pending은 기존 focus를 훔치지 않는다.
- 각 카드는 heading으로 연결된 `article`, 두 선택지는 설명된 group 안의 native button이다. 버튼 접근성 이름은 이벤트명·선택명·preview를 포함한다. 그림은 제목과 중복되므로 decorative다. 읽기 전용에서는 내용과 preview는 유지하고 button을 native disabled로 만들며 보이는 사유를 연결한다. 활성 button은 최소 44×44px이고 360px·200% 확대에서 가로 overflow나 말줄임이 없다.
- 이벤트 art는 `event.ember-shrine`, `event.wandering-smith`, `event.ash-camp` 각각 고유한 불투명 `512×512` WebP다. 각 파일은 160 KiB 이하, `status: ready`, 고유 src·SHA-256, project-owned 생성 권리와 `docs/assets/prompts/expedition-event-cards.md` 기록을 가져야 한다. 의미 실루엣은 중앙 64% 안에서 성소 U형·모루 수평형·야영지 A형으로 64px 회색조에서도 구분한다. 글자·룬·화폐·UI·워터마크를 넣지 않는다.
- pending이 없거나 카드가 viewport에 들어오기 전에는 event `GameAsset`을 mount하지 않는다. 표시 직전에만 resolver를 호출하고 primary decode 실패는 `fallback.card`, 다시 실패하면 CSS fallback으로 내려간다. 이미지·presentation metadata 실패에도 저장된 효과 preview와 명령은 유지한다.
- `SAVE_VERSION = 5`와 A/B·portable 계약은 바꾸지 않는다. focus·in-flight·이미지 상태·완료 notice는 저장하지 않는다. 성공 1회만 revision을 1 올리고 차단 입력·engine 거절·reader 입력은 write하지 않는다. 선택 전후 RNG·mask·overflow·definition version·run은 변하지 않는다.
- IRPG-506에 `visual.events.pending-three`와 `visual.events.fallback`을 추가한다. 둘 다 stage/highestStage 30, 3-bit mask, 서로 다른 pending 3개, owner `IRPG-412`, capture `.expedition-event-panel`을 사용한다. fallback route는 `events-corrupt`이며 canonical은 40개에서 48개, 3회 반복은 120개에서 144개가 된다.
- Playwright exact-once 흐름은 고정 clock의 실제 자동 전투·공개 강화 UI로 첫 milestone에 도달한 뒤 pointer/keyboard 선택, rapid double-click, reload를 통과한다. 테스트가 localStorage나 도메인 함수를 직접 호출하지 않으며, 보상·revision·카드 제거가 한 번만 유지되는지 확인한다.

## Verification

- 2026-07-19 Ready gate에서 IRPG-107 저장 상태·IRPG-409 card language·IRPG-506 시각 harness를 대조하고, 저장된 resolved effect만 표시하는 동기 feedback·A/B read-back·event ID in-flight lock·focus·card별 lazy-load·48개 canonical 계약을 승인했다.
- 독립 저장 Review는 성공 revision `+1`, 재선택·reader 무쓰기, write/read-back 실패 시 optimistic state 불변, `SAVE_VERSION = 5` 유지를 확인했고 P0·P1·P2는 0건이다.
- 독립 React·접근성 Review에서 grid 단위 선행 mount와 1,000 이상 preview 축약을 발견해 카드별 observer와 전체 정수 표시로 수정했다. 재검토 결과 pointer·Enter·Space 중복 차단, 성공·거절·외부 snapshot focus, disabled reason, 360px·200%·reduced motion·fallback의 활성 P0·P1·P2는 0건이다.
- 이벤트 art 3종은 고유 512×512 RGB WebP 5,832B·6,376B·6,576B로 제작해 고유 SHA-256·project-owned 권리·prompt record를 연결했고 validator가 ready·고유 src/hash·160KiB 상한을 강제한다.
- 첫 Ubuntu artifact의 긴 모바일 locator가 마지막 lazy-load 스크롤을 상속해 panel 상단 대신 다음 sibling을 캡처하는 P1을 발견해 승인하지 않았다. 기준 360×800·1440×900에서 geometry·overflow·명령·motion을 먼저 검증하고, 그 뒤 폭·DPR·media를 유지한 채 긴 target만 viewport 높이에 완전히 맞춰 full-surface를 캡처하도록 고쳤다. 원래 `layoutViewport`, 실제 `captureViewport`, `expanded`를 별도 artifact metadata로 남긴다.
- 독립 재검토와 로컬 48/48 생성에서 신규 event 화면, 기존 mobile battle, cards, combat log의 heading부터 target 하단까지 포함하고 sibling을 포함하지 않음을 확인했다. 최종 캡처 구현의 P0·P1은 0건이며 viewport 구분 표기 P2는 metadata·문서 계약으로 해소했다.

## Test evidence

- 완료: 로컬 `$env:CI='true'; npm run verify` — Vitest 35파일·285/285, 자산 validator 32/32, manifest 27 IDs, production build, 일반 Playwright 37/37, production 자산 Playwright 4/4 통과. canonical 비교는 계약대로 로컬 Windows에서 건너뛰었다.
- 완료: 공개 자동 전투·강화 UI로 첫 milestone에 도달한 뒤 rapid 두 입력을 보내 보상·revision·카드 제거 1회, reload 유지와 page/console error 0건을 확인했다. 별도 200% 흐름은 카드별 이미지 요청 0→1→2→3, corrupt primary의 `fallback.card`, Enter 선택 뒤 다음 카드 focus를 확인해 신규 Playwright 2/2가 통과했다.
- 완료: 컴포넌트·hook 회귀에서 pending 0~3, exact saved preview, 1,000 이상 비축약, presentation metadata fallback, pointer 중복 차단, 성공·거절·reader snapshot focus, 성공 revision `+1`, 재선택·reader·save-failed no-write를 검증했다.
- 완료: commit `403f342`의 [Ubuntu visual run 29683912454](https://github.com/happypod/games01/actions/runs/29683912454)에서 named fixture 12개 × 4 variants = canonical 48/48과 같은 runner 3회 반복 144/144가 통과했다. artifact `irpg-506-ubuntu-baselines` ID `8441503083`, ZIP SHA-256 `609b282cbe19692a150d1bc94a238033f0fee0b52c3e4c1a787d6cbd58ca9719`, 13,417,695B, 만료일 2026-08-02를 확인했다.
- 완료: artifact PNG 48개를 정상 decode하고 저장소 40개와 대조해 24개 byte-identical, 잘못 잘린 mobile battle과 panel 삽입 뒤 cards·combat log 16개 승인 갱신, 신규 event 8개 추가를 확인했다. event의 mobile·desktop × default·reduced 8개는 heading·pending 3개·고유 art 또는 `fallback.card`·두 선택지·panel 하단을 포함하고 sibling·overflow·decode 오류가 없다.
- 대기: 승인한 48개 기준선을 체크인한 뒤 동일 SHA의 push·PR quality gate에서 생성이 아닌 canonical 비교를 통과한다.
