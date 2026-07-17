# IRPG-503 — CI 릴리스 게이트

## Outcome

모든 push와 pull request에서 재현 가능한 설치와 전체 품질 게이트를 실행하고, 통과 결과와 브라우저 진단 artifact를 원격 증거로 남긴다.

## Priority / Status / Skill tags

- Priority: P0
- Status: Done
- Skill tags: REL-CI
- Dependency: IRPG-003 Done, IRPG-501 Done
- Owner / Reviewer: Codex / independent CI audit

## Scope

- 모든 branch push와 pull request에서 `quality-gate` workflow 실행
- Node.js 24와 npm cache 구성 후 `npm ci` clean install
- `npx playwright install --with-deps chromium`으로 브라우저와 시스템 의존성 설치
- `npm run verify`로 lint, strict typecheck, Vitest, production build, Playwright 실행
- 취소되지 않은 실행에서 `playwright-report`와 `test-results` artifact 보존
- 읽기 전용 저장소 권한과 15분 job timeout

## Non-scope

- 운영 배포, 릴리스 발행, 환경 변수와 비밀 관리
- Firefox·WebKit·모바일 전체 브라우저 매트릭스
- 24시간 이상 soak와 장기 성능 회귀

## Dependencies

- IRPG-003의 Node 요구 버전과 로컬 품질 명령
- IRPG-501의 도메인·UI 자동 테스트
- GitHub-hosted `ubuntu-latest` runner와 Chromium 패키지 저장소

## Impacts

- Save schema: none
- Content config: none
- Accessibility: none
- Release tooling: GitHub Actions workflow added, npm lockfile synchronized

## Acceptance criteria

- Given 깨끗한 Ubuntu runner, when branch를 push하거나 pull request를 갱신하면, then `npm ci`가 잠금 파일만으로 성공한다.
- Given 의존성과 Chromium이 설치됐을 때, when `npm run verify`를 실행하면, then lint, strict typecheck, Vitest, production build, Playwright가 모두 통과한다.
- Given workflow가 취소되지 않았을 때, when 검증이 종료되면, then `playwright-report` artifact가 생성되고 14일 동안 보존된다.
- Given 동일한 head SHA, when push와 pull request workflow가 각각 실행되면, then 두 실행 모두 `success` 결론을 남긴다.

## Design

`.github/workflows/ci.yml`의 단일 `verify` job이 설치부터 브라우저 테스트까지 순서대로 실행한다. push와 pull request 이벤트를 모두 사용해 branch 단독 변경과 병합 후보를 각각 검증한다. workflow 권한은 `contents: read`로 제한하고 Playwright는 CI에서 worker 1, retry 1로 실행한다.

## Verification

- 최초 구현 SHA `86b5ce6f3c4a473a9ddfab0b73a9618a7f3e05a1`의 [push 실행](https://github.com/happypod/games01/actions/runs/29565062156)과 [pull request 실행](https://github.com/happypod/games01/actions/runs/29565157162)은 `npm ci`에서 누락된 optional WASM peer를 발견해 실패했다.
- `package.json`만 있는 Node.js 24.13.0 / npm 11.6.2 환경에서 잠금 파일을 다시 생성해 `@emnapi/core`와 `@emnapi/runtime`을 루트 optional peer로 정규화했다.
- [`actions/upload-artifact@v6`](https://github.com/actions/upload-artifact/releases/tag/v6.0.0)은 Node.js 24 런타임을 사용하며, GitHub-hosted runner에서 기존 입력과 artifact 계약을 그대로 유지함을 확인했다.
- 저장 규칙, 게임 상태, 전투 수식, UI 계약은 바꾸지 않았고 정적 CI 감사에서 workflow 범위와 실패 진단 경로를 승인했다.

## Test evidence

- Draft [PR #1](https://github.com/happypod/games01/pull/1), branch `agent/irpg-503-ci-gate`
- 검증된 구현 head: [`0972e0ebfe9bd09e584d8892c816ff28299668d8`](https://github.com/happypod/games01/commit/0972e0ebfe9bd09e584d8892c816ff28299668d8)
- 로컬 `npm ci --dry-run --include=optional`: peer·optional 경고 없이 통과
- 로컬 `npm ci`: 251 packages 설치, 취약점 0건
- 로컬 `npm run verify`: ESLint, strict typecheck, Vitest 5개 파일 28개 테스트, production build, Playwright Chromium 1개 전체 흐름 통과
- [push run 29566031810](https://github.com/happypod/games01/actions/runs/29566031810) / [verify job 87838740037](https://github.com/happypod/games01/actions/runs/29566031810/job/87838740037): event `push`, conclusion `success`
- [pull request run 29566034688](https://github.com/happypod/games01/actions/runs/29566034688) / [verify job 87838749728](https://github.com/happypod/games01/actions/runs/29566034688/job/87838749728): event `pull_request`, conclusion `success`
- 두 원격 실행 모두 `npm ci`, Chromium `--with-deps`, `npm run verify`를 통과했다.
- `playwright-report` artifact: push artifact `8401137699` 198,424 bytes, pull request artifact `8401144574` 233,003 bytes, retention 14일
- v6 유지보수 head [`beb73b8b9f4763592ce406b964a51f28bcdd5fdb`](https://github.com/happypod/games01/commit/beb73b8b9f4763592ce406b964a51f28bcdd5fdb): [push run 29581371205](https://github.com/happypod/games01/actions/runs/29581371205)와 [pull request run 29581372983](https://github.com/happypod/games01/actions/runs/29581372983) 모두 `success`, `Upload Playwright report` 단계 성공, artifact `8407151103`·`8407161950` 생성, check annotation 0건
