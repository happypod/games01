# IRPG-406 — 시각 자산 계약·manifest

## Outcome

캐릭터·맵·카드·결과 화면 자산이 안정적인 ID, 규격, 권리 정보와 fallback을 공유하며 누락·중복을 자동 검출한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Ready
- Skill tags: ART-DIR, ART-2D, ENG-DATA
- Owner / Reviewer: Codex / art direction and frontend reviewers

## Scope

- hero·enemy·boss·region·equipment·skill·result·event 용도의 `assetId` namespace
- 아래 필수 ID inventory와 placeholder entry
- 로컬 파일 경로, 용도, 픽셀 크기, 포맷, 바이트 예산, 출처·권리 metadata schema
- 용도별 텍스트·CSS fallback과 manifest validator
- 색·광원·실루엣·crop의 1페이지 스타일·export 규격

## Non-scope

- 최종 일러스트 제작, 애니메이션·사운드
- CDN·원격 CMS·유료 asset 구매
- asset ID나 파일 경로의 `GameState` 저장

## Dependencies

- IRPG-401 현재 UI 구조
- IRPG-403 접근성 기준선
- IRPG-505 G4 하드닝 완료

## Impacts

- Save schema: none
- Content config: stable visual asset IDs added
- Accessibility: fallback and decorative/meaningful image rules required

## Acceptance criteria

- Given manifest일 때, when validator를 실행하면, then asset ID 중복·누락 파일·허용하지 않은 원격 URL·잘못된 용도/크기/포맷을 실패시킨다.
- Given 이미지 load 실패 또는 ID 누락일 때, when UI가 자산을 요청하면, then 텍스트 이름과 용도별 fallback이 표시되고 전투·저장·탐색은 계속된다.
- Given 모든 자산일 때, when 권리와 성능을 검토하면, then 출처·라이선스·제작 방식과 바이트 예산이 manifest에 기록된다.
- Given production `dist`의 첫 전투 route를 cache-disabled cold load할 때, when build size·브라우저 network assertion을 실행하면, then 아래 gzip·URL 계약으로 계산한 초기 전송량은 600 KiB 이하이고 region·card·result·event 자산은 사용 전까지 요청되지 않는다.
- Given 저장·내보내기 fixture일 때, when manifest를 추가해도, then asset ID·경로가 `GameState`나 portable backup에 들어가지 않는다.

## Design

manifest는 코드와 같은 저장소에 있는 단일 출처이며 배포 파일은 `src/assets/game` 아래에 둔다. 콘텐츠는 안정적인 `assetId`만 참조하고 resolver가 로컬 경로와 fallback을 반환한다. 원본 제작 파일은 배포 번들과 구분한다.

필수 ID inventory:

- `hero.ashen-knight.default`
- 일반 적 5개: `enemy.ash-slime`, `enemy.twilight-wolf`, `enemy.abandoned-armor`, `enemy.charred-shaman`, `enemy.abyss-sentinel`
- 보스 3개: `boss.ash-giant`, `boss.eclipse-knight`, `boss.forgotten-dragon`
- 지역 3개: `region.ashen-border`, `region.moonfall-pass`, `region.forgotten-caldera`
- 장비 3개: `equipment.ember-blade`, `equipment.guard-armor`, `equipment.fortune-charm`
- 스킬 3개: `skill.power-strike`, `skill.iron-will`, `skill.loot-sense`
- 결과 2개: `result.boss-victory`, `result.defeat`
- 원정 event 3개: `event.ember-shrine`, `event.wandering-smith`, `event.ash-camp`
- 범용 fallback: `fallback.character`, `fallback.region`, `fallback.card`, `fallback.result`

배포 규격은 portrait `768×768 WebP ≤ 250 KiB`, card `512×512 WebP ≤ 160 KiB`, region `1600×900 WebP ≤ 350 KiB`, result `1280×720 WebP ≤ 300 KiB`, fallback `SVG/CSS ≤ 20 KiB`다. SVG는 검토된 UI/fallback vector에만 허용하고 raster 일러스트는 WebP로 배포한다.

초기 전투 route는 manifest runtime·fallback·현재 hero·현재 enemy만 eager load하며 전송량 합계를 600 KiB 이하로 제한한다. 측정은 clean production build와 빈 Chromium context에서 `networkidle` 전 받은 document·정적 및 동적 JS chunk·CSS·font·image의 고유한 로컬 URL 합집합을 `dist` 파일로 해석하고, source map을 제외한 각 원본 bytes를 Node `zlib.gzipSync(..., { level: 9 })`로 압축한 길이 합계다. 같은 URL은 한 번만 세며 HTTP header·브라우저 자체 request·Playwright binary는 제외한다. 이 build 기반 수치가 pass/fail 기준이며 OS·서버의 Brotli 선택에 의존하지 않는다.

Playwright는 production `dist`를 `Cache-Control: no-store`로 제공하고 빈 browser context에서 request URL set을 기록한다. 나머지 enemy·boss는 전투 대상이 되기 직전에 preload하고 `region.*`·`equipment.*`·`skill.*`·`result.*`·`event.*` 자산은 해당 panel·event를 처음 열 때 lazy import한다. cold load URL set에 이 namespace가 하나라도 있으면 크기와 관계없이 실패한다. validator의 개별 파일 예산, build gzip 합계와 network request를 함께 검사해 aggregate·lazy-load 계약을 강제한다.

각 entry는 `{ id, kind, src, width, height, bytes, sourceType, author, license, attribution?, proofPath?, sourceUrl?, generator?, promptRecord? }`를 가진다. `sourceType`은 `original | generated | licensed`, `license`는 `project-owned | CC0-1.0 | CC-BY-4.0 | commercial-redistribution` 중 하나다. CC-BY는 attribution, commercial license는 저장소 안의 proofPath, generated는 generator와 promptRecord를 필수로 한다. `sourceUrl`은 출처 증거에만 허용하며 실제 `src`는 로컬 상대 경로여야 한다.

validator는 manifest 선언만 믿지 않고 실제 파일 header의 포맷·픽셀과 파일 byte를 대조한다. fixture는 정상 manifest, duplicate ID, missing file, remote `src`, 경로 이탈, 잘못된 치수·포맷·예산, 누락된 attribution/proof/generator metadata를 포함한다.

## Verification

- ID namespace, fallback, 권리 metadata, 모바일 다운로드 예산을 Review한다.

## Test evidence

- 예정: manifest validator 단위 테스트, 누락 파일 fixture, clean build gzip 합계와 cache-disabled production network assertion
