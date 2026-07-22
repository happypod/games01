# IRPG-407 — 플레이 화면 영웅 캐릭터 표시

## Outcome

플레이 화면의 영웅 상태 카드에 `방랑 기사 아렌`의 완성 일러스트가 항상 표시되고 이미지 실패에도 이름·HP·전투·저장이 유지된다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK
- Owner / Reviewer: Codex / art direction and accessibility reviewers

## Scope

- `hero.ashen-knight.default`용 768×768 WebP 완성 일러스트 1개, 250 KiB 이하
- IRPG-406 manifest·resolver와 `HeroPanel` 연결
- 헤더 아래·HP 위의 고정 비율 portrait와 CSS/SVG 오류 fallback
- 360×800·1440×900·200% 확대·reduced-motion 검증
- 생성 방식·prompt·권리 metadata와 production 초기 600 KiB 예산 갱신

## Non-scope

- 일반 적·보스 일러스트(IRPG-413)
- 장비별 외형, 스킨, 애니메이션
- 전투 수식·RNG·보상·저장 schema 변경
- `BattleArena` 대전 구도 재설계

## Dependencies

- IRPG-403 접근성 기준선
- IRPG-406 asset manifest·fallback·성능 게이트

## Impacts

- Save schema: none
- Game state/formula: none
- Content config: 기존 `hero.ashen-knight.default` placeholder를 final generated asset으로 교체
- Accessibility: 이름·레벨·HP HTML이 권위 정보이며 일러스트는 decorative

## Acceptance criteria

- Given 정상 자산일 때, when 첫 플레이 화면을 열면, then 아렌 일러스트가 이름·레벨·HP와 함께 올바른 stable ID로 표시된다.
- Given 느린 load·decode 실패·파일 누락일 때, when 자동 전투가 진행되면, then 프레임 크기가 이동하지 않고 SVG 또는 CSS fallback과 텍스트 정보가 유지되며 전투·저장이 계속된다.
- Given 360×800·1440×900·200% 확대일 때, when 영웅 카드를 확인하면, then 가로 overflow나 portrait·제목·HP 겹침이 없다.
- Given 스크린리더·reduced-motion일 때, when 화면을 탐색하면, then 중복 영웅 이미지 이름과 신규 지속 animation이 없다.
- Given production build일 때, when 자산 validator와 cold-load gate를 실행하면, then WebP는 768×768·250 KiB 이하이고 초기 고유 URL gzip 합계는 600 KiB 이하이다.

## Design

`HeroPanel`은 헤더 → portrait → HP·XP 순서를 사용한다. portrait는 `clamp(144px, 48%, 176px)`의 1:1 공간을 첫 렌더부터 확보하고 `object-fit: contain`, `object-position: center bottom`으로 표시한다. 실제 `<img>`는 768×768, eager, async decode, `alt=""`, `aria-hidden="true"`다. 원본 오류는 `fallback.character`를 한 번만 시도하고 두 번째 오류는 CSS silhouette만 남긴다.

## Verification

- 독립 art direction·접근성 Review에서 P0/P1 0건으로 PASS했다. 200% 확대 비겹침 증거와 티켓 분할 뒤 stale 문구 P2 두 건도 같은 변경에서 보강했다.
- 최종 자산은 768×768 RGB WebP 52,654 bytes이며 단일 인물, 텍스트·로고·워터마크·고어 없음과 charcoal·rust-red·ember 방향을 충족한다.
- manifest의 stable ID, `ready` 상태, generated 권리·generator·prompt record와 실제 header·치수·bytes가 일치한다.
- 1440×900·360×800·200% 확대에서 portrait·제목·HP 비겹침과 가로 overflow 없음, reduced-motion과 decorative 접근성 처리를 확인했다.
- corrupt WebP decode에서 `fallback.character`로 전환된 뒤에도 6초 자동 전투 처치와 자동 저장 상태가 계속됨을 확인했다.
- production 초기 연결 파일 gzip 상한 계산은 136,223 bytes이고 614,400 bytes 계약 아래다. cold-load에서 영웅·현재 적만 요청되고 lazy namespace는 요청되지 않았다.

## Test evidence

- `npm run verify`: lint, strict typecheck, Vitest 16파일·95테스트, validator 21/21, manifest CLI, production build, 일반 Playwright 12/12, production 자산 Playwright 2/2 통과.
- `e2e/hero-portrait.spec.ts`: 1440px 정상 art·decorative semantics, 360px geometry, 200% 확대·reduced-motion geometry, corrupt decode fallback·전투·저장 4/4 통과.
- Playwright evidence: `irpg-407-hero-1440.png`, `irpg-407-hero-360.png`, `irpg-407-hero-fallback.png`을 test artifact로 생성했다.
- `npm run assets:validate`: `hero.ashen-knight.default`의 768×768, 52,654 bytes, generated metadata와 전체 27개 ID가 유효하다.
