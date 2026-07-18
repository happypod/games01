# IRPG-507 — 브라우저 개발자 디버그 패널

## Outcome

개발 빌드에서 배속·stage·자원·오프라인 시간을 안전하게 조절해 UI 상태를 빠르게 재현하고 production에는 노출하지 않는다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: FE-GAME, QA-DOMAIN
- Owner / Reviewer: unassigned / frontend and QA reviewers

## Scope

- development/test mode 전용 1x·10x·100x, stage, gold·SP·essence, offline duration control
- 입력 범위·확인·초기화와 debug session 표시
- IRPG-505 순수 러너·기존 engine command를 사용하는 adapter

## Non-scope

- production cheat, 사용자 저장 편집기, 서버 운영 도구
- 범위를 우회하는 직접 객체 mutation
- 7일 soak와 visual baseline 승인

## Dependencies

- IRPG-403 접근성 기준선
- IRPG-505 debug simulator

## Impacts

- Save schema: none; debug state is isolated from normal saves
- Content config: none
- Accessibility: keyboard labels and destructive confirmation required

## Acceptance criteria

- Given development build 또는 Playwright test mode일 때, when panel을 열면, then 배속·stage·자원·offline 조절이 명시된 범위와 순수 command를 통해 적용된다.
- Given production build일 때, when bundle·DOM을 검사하면, then panel trigger와 debug code path가 노출되지 않는다.
- Given debug session일 때, when reload·닫기·초기화를 수행하면, then 정상 A/B 저장을 덮어쓰지 않고 원래 저장으로 복귀한다.
- Given 잘못된 숫자·최대 경계일 때, when 적용하면, then 거부 이유를 표시하고 NaN·음수·미래 저장을 만들지 않는다.

## Design

debug session은 정상 writer와 분리한 메모리 상태를 사용한다. 적용 명령은 입력 validation을 통과한 뒤 기존 engine 또는 debug simulator API를 호출하며 직접 저장 객체를 수정하지 않는다.

## Verification

- production tree-shaking, A/B 저장 격리, 입력 경계·키보드 흐름을 Review한다.

## Test evidence

- 예정: dev/prod build 분기 테스트와 browser debug isolation Playwright 흐름
