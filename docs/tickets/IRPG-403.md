# IRPG-403 — 모바일·키보드·스크린리더·모션 감소 감사

## Outcome

360px 모바일과 확대 화면에서도 진행이 잘리지 않고, 마우스·지속 애니메이션 없이 주요 게임·저장 흐름을 이해하고 조작할 수 있다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: UX-FEEDBACK, FE-GAME, QA-E2E
- Owner / Reviewer: Codex / independent accessibility and test reviews

## Scope

- 360×800과 CSS 200% 확대에서 가로 overflow·가려진 핵심 버튼 검사
- 본문 바로가기, 일관된 `:focus-visible`, 44px pointer target
- HP·XP·적 HP의 native-equivalent progressbar semantics
- 장식 glyph·ambient를 접근성 트리에서 제거하고 버튼 설명과 landmark 이름 보강
- 공용 modal focus trap, Escape 닫기, 안전한 초기 focus, 닫은 뒤 이전 focus 복귀
- 작은 본문·보조 텍스트 대비 보강
- `prefers-reduced-motion: reduce`에서 animation·transition 완전 제거
- bundled Chromium 자동 게이트와 설치된 Chrome·Edge 교차 실행

## Non-scope

- WCAG 전체 사이트 인증서, 외부 전문 감사, 모든 브라우저·보조공학 조합
- 게임 미술 자체의 색각 보정과 신규 일러스트 대체 텍스트
- native confirm dialog의 운영체제별 구현 변경

## Dependencies

- IRPG-401 핵심 UI
- IRPG-304 저장 preview modal
- 360×800, reduced-motion Playwright context와 설치된 Chrome·Edge

## Impacts

- Save schema: none
- Content config: none
- Accessibility: keyboard, screenreader semantics, contrast, target size, motion updated

## Acceptance criteria

- Given 360×800 viewport 또는 200% CSS 확대일 때, when 전체 페이지를 탐색하면, then document 가로 overflow가 없고 표시된 핵심 조작의 bounding box가 viewport 밖으로 잘리지 않는다.
- Given 마우스를 사용하지 않을 때, when Tab·Shift+Tab·Enter로 바로가기·강화·저장 file input을 이동하면, then focus가 보이고 의도한 동작이 실행된다.
- Given modal이 열렸을 때, when Tab·Shift+Tab·Escape를 사용하면, then focus가 dialog 안에 갇히고 Escape로 닫힌 뒤 열기 전 요소로 돌아간다.
- Given 스크린리더 의미 트리일 때, when 주요 화면을 읽으면, then banner/main/region/dialog/progressbar의 이름·값·상태가 텍스트 순서로 식별되고 장식 glyph는 중복 낭독되지 않는다.
- Given reduced motion 설정일 때, when 전투 화면을 표시하면, then aura·live pulse animation과 진행 bar transition의 computed 값이 `none`/`0s`다.
- Given Chrome·Edge 최신에서, when 접근성 Playwright 시나리오를 실행하면, then page/console error 없이 통과한다.

## Design

공용 `useModalFocus` hook이 dialog 이전 active element를 저장하고, focusable 목록의 처음·끝에서 Tab을 순환시키며 Escape close와 unmount focus 복귀를 담당한다. modal 컴포넌트는 안전한 취소/확인 버튼에 `data-initial-focus`를 지정한다.

`StatBar`는 시각 track과 별개로 `role=progressbar`, `aria-valuemin/max/now/valuetext`를 제공한다. 장식용 기호는 `aria-hidden`, 정보 상태는 기존 텍스트·live region으로 유지한다. reduced-motion media query는 짧은 duration 흉내 대신 animation/transition 자체를 제거한다.

## Verification

- 공용 modal hook의 초기 focus, Tab 순환, Escape 닫기, 이전 focus 복귀 수명주기를 컴포넌트 테스트와 실제 브라우저에서 확인했다.
- 360×800에서 가로 overflow가 없고 표시된 버튼·브랜드·파일 선택 target이 모두 44px 이상이며 viewport 안에 있음을 자동 측정했다.
- CSS 200% 확대와 reduced-motion context에서 overflow, aura·pulse animation, progress transition의 computed style을 확인했다.
- 360px 전체 화면을 직접 검토해 단일 열, 텍스트·버튼 가림, focus 잔상 문제가 없음을 확인했다.

## Test evidence

- `npm run verify`: lint, strict typecheck, Vitest 8파일·44테스트, production build, Playwright 5테스트 통과.
- `npm run test:e2e -- e2e/accessibility.spec.ts`: bundled Chromium 2/2 통과.
- `PLAYWRIGHT_CHANNEL=chrome|msedge`로 동일 시나리오를 실행해 Chrome 2/2, Edge 2/2 각각 통과하고 page/console error가 없음을 확인.
- `App.test.tsx`, `OfflineReport.test.tsx`, `SaveTransferPanel.test.tsx`: progressbar 의미와 modal focus trap·Escape·복귀 회귀 검증.
- [360×800 전체 화면](../../artifacts/irpg-403-360.png): 단일 열과 핵심 조작의 잘림 없는 렌더링을 직접 확인.
