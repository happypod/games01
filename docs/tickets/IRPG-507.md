# IRPG-507 — 브라우저 개발자 디버그 패널

## Outcome

개발 빌드에서 배속·stage·자원·오프라인 시간을 안전하게 조절해 UI 상태를 빠르게 재현하고 production에는 노출하지 않는다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Done
- Skill tags: FE-GAME, QA-DOMAIN
- Owner / Reviewer: Codex implementation / independent frontend and QA review

## Scope

- development mode 전용 1x·10x·100x, stage, gold·SP·essence, offline duration control
- speed는 `1 | 10 | 100`, stage는 정수 `1..300`, 자원은 안전한 정수 `0..Number.MAX_SAFE_INTEGER`, offline은 정수 `0..480분`으로 제한한다.
- 입력 오류·적용 확인·세션 초기화·종료와 `DEBUG · 저장 격리` 상태를 키보드와 스크린리더로 확인할 수 있게 표시한다.
- IRPG-505 순수 러너·기존 engine command를 사용하는 adapter와 저장 reader snapshot의 메모리 복제본

## Non-scope

- production cheat, 사용자 저장 편집기, 서버 운영 도구
- 범위를 우회하는 직접 객체 mutation
- 7일 soak와 visual baseline 승인
- debug session의 stage·자원·시간을 정상 A/B 저장으로 승격하는 기능

## Dependencies

- IRPG-403 접근성 기준선
- IRPG-505 debug simulator

## Impacts

- Save schema: none; debug state is isolated from normal saves
- Content config: none
- Accessibility: keyboard labels and destructive confirmation required
- Fixtures / clock: 기존 A/B·legacy save fixture, Playwright 가짜 시계와 고정 reader snapshot

## Acceptance criteria

- Given development build의 정상 게임일 때, when 사용자가 개발자 패널 시작을 확인하면, then 정상 writer를 해제하고 최신 유효 reader snapshot의 메모리 복제본으로 격리 세션을 시작하며 `DEBUG · 저장 격리`를 표시한다.
- Given 격리 세션일 때, when 1x·10x·100x 배속, stage `1..300`, gold·SP·essence 안전 정수, offline `0..480분`을 적용하면, then 검증된 순수 adapter와 engine command로만 즉시 UI에 반영한다.
- Given 격리 세션일 때, when 5초 이상 경과하거나 pagehide·reload·세션 초기화를 수행하면, then legacy/A/B 키 원문이 byte-for-byte 동일하고 초기화·reload는 reader 기준선으로 복귀한다.
- Given 세션 종료일 때, when 정상 게임으로 돌아가면, then 기존 writer의 offline checkpoint revision 증가는 허용하되 debug stage·자원·시간 값은 어떤 저장 슬롯에도 유출되지 않는다.
- Given production build일 때, when manifest·모든 JS/CSS·DOM을 검사하고 query·hash·localStorage를 조작하면, then panel trigger, `src/debug/`, `IRPG507_DEBUG_PANEL` sentinel과 debug code path가 존재하지 않는다.
- Given `NaN`, 소수, 음수, 안전 정수 초과, stage `0/301`, offline `481분`일 때, when 적용하면, then 이유를 `role=alert`로 표시하고 상태와 저장 원문을 바꾸지 않는다.

## Design

`main.tsx`는 `import.meta.env.DEV` 상수로만 dev entry를 동적 import하고 production graph에는 debug component·adapter·CSS를 정적 import하지 않는다. URL·환경 변수·storage 값으로 production에서 우회 활성화하는 경로를 두지 않는다.

dev entry는 정상 화면과 격리 화면을 동시에 마운트하지 않는다. 격리 시작 전 정상 `useGame` tree를 unmount해 writer를 해제하고, sessionStorage의 비영속 marker로 reload 뒤에도 `bootstrapGame(localStorage, now, 'reader')`만 실행한다. reader snapshot은 세션 기준선과 작업 복제본으로 각각 deep clone한다. 시작 시 아직 autosave되지 않은 화면 상태는 포함하지 않을 수 있음을 시작 확인문에 알린다.

debug adapter는 기존 `selectStage`를 사용할 수 있도록 clone의 `highestStage`만 stage 입력까지 확장한다. offline은 `runDebugSimulation`, 실시간 배속은 실제 경과시간을 1x·10x·100x와 8시간 상한으로 환산한 뒤 `advanceGame`을 사용한다. 자원 설정도 새 clone을 반환하며 입력 객체를 mutate하지 않는다. debug tree는 `saveGameAtRevision`, `clearSave`, import, writer lock, autosave와 pagehide 저장을 호출하지 않는다.

UI 상태는 정상 진입 버튼, 격리 활성 상태, 입력 오류, 적용 완료, 최대 경계, 초기화 확인, 종료 확인을 포함한다. 격리 상태에서는 저장 내보내기·가져오기를 표시하지 않는다.

## Verification

- production tree-shaking, A/B 저장 격리, 입력 경계·키보드 흐름을 Review한다.
- pure adapter unit test, dev component test, Playwright 저장 원문 비교와 production bundle/DOM 부재 검사를 통과한다.

## Test evidence

- `npm run verify`: ESLint, strict TypeScript, Vitest 20파일·127테스트, asset validator 21테스트, manifest 27 IDs, production build 통과
- `npm test -- src/debug`: 순수 adapter·패널·격리 controller 3파일·14테스트 통과; legacy/A/B raw byte 불변과 `Storage.setItem` 0회 확인
- `e2e/debug-panel.spec.ts`: 1x·100x, stage 300, 자원, 1분 offline, 잘못된 경계, 5초 대기, pagehide, reload, reset, 정상 종료 흐름 1/1 통과
- 일반 Playwright 13/13 통과; 기존 저장·동료·접근성 흐름 회귀 없음
- production asset Playwright 3/3 통과; manifest·전체 JS/CSS·query·hash·localStorage·DOM에서 debug sentinel과 trigger 부재 확인
- 독립 Review PASS: P0/P1 0건. P2의 writer 2단계 해제, sessionStorage read-back 실패 차단, 실제 경과시간 배속을 반영했다.
