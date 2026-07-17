# IRPG-405 — Windows 원클릭 실행기

## Outcome

Windows 사용자가 저장소 루트의 실행 파일을 더블클릭해 필요한 의존성을 준비하고 Emberwatch를 기본 브라우저에서 바로 시작한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: REL-CI, UX-FEEDBACK
- Owner / Reviewer: Codex / independent launcher audit

## Scope

- 저장소 루트의 `게임실행.cmd`
- 실행 위치와 무관하게 저장소 루트로 이동
- Node.js와 npm 존재 여부 및 최소 Node 버전 확인
- 의존성이 없을 때 잠금 파일 기반 `npm ci` 자동 실행
- Vite 개발 서버 시작과 실제 선택 URL의 기본 브라우저 자동 열기
- 서버·브라우저를 시작하지 않는 `--check` 점검 모드
- README에 더블클릭 실행과 종료 방법 기록

## Non-scope

- Node.js 자동 설치와 관리자 권한 상승
- Node.js를 포함한 독립 실행형 `.exe` 패키징
- 운영 배포, 자동 업데이트, 바탕화면 바로가기 생성
- 게임 상태·저장 데이터 초기화 또는 이동

## Dependencies

- IRPG-003 Done
- Node.js 22.12 이상과 npm
- 현재 `package-lock.json`과 `dev` 스크립트

## Impacts

- Save schema: none
- Content config: none
- Accessibility: none

## Acceptance criteria

- Given Node.js 22.12 이상과 npm이 설치됐을 때, when `게임실행.cmd`를 더블클릭하면, then 저장소 루트에서 Vite가 시작되고 실제 선택 URL이 기본 브라우저로 열린다.
- Given `node_modules`가 없을 때, when 실행기를 시작하면, then `npm ci`가 성공한 뒤에만 게임 서버가 시작된다.
- Given Node.js·npm이 없거나 버전이 낮을 때, when 실행기를 시작하면, then 원인을 표시하고 게임 서버를 시작하지 않는다.
- Given `--check` 인자일 때, when 실행기를 호출하면, then 서버와 브라우저를 시작하지 않고 환경 점검 결과와 성공 종료 코드를 반환한다.
- Given 서버가 실행 중일 때, when 사용자가 실행 창에서 `Ctrl+C`를 누르면, then 개발 서버가 종료된다.

## Design

Windows batch의 `%~dp0`를 기준 경로로 사용하고 `where`, `node -e`, `npm.cmd ci`, `npm.cmd run dev -- --open`을 순서대로 실행한다. Vite의 `--open`이 포트 충돌 시 실제 선택된 URL을 열도록 맡긴다. 실행기는 게임 상태, 브라우저 저장소, 소스 코드를 변경하지 않는다.

## Verification

- 구현 전 상태·수식·저장 영향이 없음을 제품·아키텍처 계약과 대조했다.
- 독립 launcher audit에서 `%~dp0` 경로 처리, Node 버전 검사, `npm.cmd`의 `call`, Vite 실제 포트 `--open`, `Ctrl+C` 종료 흐름을 승인했다.
- 최초 한글 UTF-8 batch 메시지는 Windows CMD 점검에서 파싱 오류를 일으켜, 한글 파일명은 유지하고 실행 파일 내부 명령과 메시지를 ASCII로 제한했다.

## Test evidence

- `cmd.exe /d /c "게임실행.cmd --check"`: Node.js v24.13.0, game packages와 Vite 준비 상태 확인, exit code 0, 서버·브라우저 미기동
- `npm run verify`: ESLint, strict typecheck, Vitest 5개 파일 28개 테스트, production build, Playwright Chromium 전체 흐름 1개 통과
- README에서 원클릭 실행, 첫 설치, 브라우저 자동 열기, `Ctrl+C` 종료와 수동 실행 경로를 함께 기록했다.
