# IRPG-504 — Playwright 전체 흐름

## Outcome

신규 원정부터 강화, 재접속, 오프라인 정산까지 저장을 포함한 핵심 사용자 흐름을 실제 Chromium에서 반복 검증한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: QA-E2E, ENG-SAVE, REL-CI
- Dependency: IRPG-402 Done, IRPG-503 Done
- Owner / Reviewer: Codex / independent E2E·quality audit

## Scope

- Playwright Chromium 프로젝트와 로컬 Vite web server
- 신규 저장 → 첫 불씨 검 강화 → reload 유지
- 페이지 종료 후 1분 경과 → 오프라인 보고 → 확인 후 reload 중복 방지
- 브라우저 page/console error 수집
- 실패 시 trace·screenshot·video와 CI artifact 보존
- `npm run verify`의 브라우저 E2E 포함

## Non-scope

- Firefox·WebKit 및 모바일 뷰포트 전체 매트릭스: IRPG-403 후속
- 24시간·7일 soak: IRPG-505
- 원격 workflow 자체의 최초 성공 증거: IRPG-503
- 저장 키 직접 주입이나 운영 코드 전용 테스트 우회로

## State / formula / save impact

- 게임 상태, 전투 수식, 저장 포맷에는 영향이 없다.
- 격리된 브라우저 context와 고정 시계를 fixture로 사용한다.
- localStorage는 UI 명령과 페이지 생명주기를 통해서만 생성·갱신한다.

## Acceptance criteria

- 빈 context에서 자동 원정과 Lv.0 불씨 검을 확인한다.
- 브라우저 시각 6초 경과 후 UI로 불씨 검을 구매하고 Lv.1을 확인한다.
- reload 뒤 Lv.1이 유지되고 오프라인 보고가 나타나지 않는다.
- 페이지를 닫고 1분 뒤 재접속하면 정확히 한 번 오프라인 보고가 나타난다.
- 보고를 확인하고 같은 시각에 reload하면 보고가 다시 나타나지 않는다.
- 전체 흐름 동안 page error와 console error가 없고 CI 실패 진단 artifact가 남는다.

## Verification

- 독립 Review에서 strict typecheck 포함 범위, locator 안정성, 시계 재현성, 저장 키 비의존성, 오류 수집을 승인했다.
- 최종 reload 전후 표시 골드가 동일하고 오프라인 dialog가 재출현하지 않아 같은 시간 구간의 보상 중복이 없음을 검증한다.
- IRPG-503의 구현 head `0972e0ebfe9bd09e584d8892c816ff28299668d8`에서 push와 pull request 품질 게이트가 모두 성공해 선행 조건을 충족했다.

## Test evidence

- `npm run verify`: lint, strict typecheck, Vitest 5개 파일 28개 테스트, production build, Playwright Chromium 전체 흐름 1개 통과
- Playwright 단일 실행: 시나리오 4.6초, 전체 9.1초, page/console error 0건
- `npm run test:e2e -- --repeat-each=3 --reporter=line`: 격리 context 3/3 통과(26.4초)
- `npm run test:coverage`: statements 93.42%, branches 87.95%, functions 97.91%, lines 95.60%
- `artifacts/irpg-504-dev-check.png`: 본문과 핵심 상호작용 요소 렌더링, 오류 overlay 없음, console error 없음
- CI는 Chromium `--with-deps`, worker 1, retry 1, 실패 report·trace·screenshot·video artifact를 구성했다.
- Draft [PR #1](https://github.com/happypod/games01/pull/1)의 [push 품질 게이트](https://github.com/happypod/games01/actions/runs/29566031810)와 [pull request 품질 게이트](https://github.com/happypod/games01/actions/runs/29566034688)가 동일한 head `0972e0ebfe9bd09e584d8892c816ff28299668d8`에서 성공했다.
- 두 원격 실행 모두 Chromium 전체 흐름 1개를 통과하고 `playwright-report` artifact를 생성했다.
