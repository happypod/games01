# IRPG-205 — 외부 사용자 첫 환생 플레이테스트

## Outcome

외부 사용자 10명 이상이 실제 시간으로 첫 원정을 플레이한 기록으로 30~45분 목표, 진행 차단, 이해하기 어려운 용어와 재미·기대 문제를 검증한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Draft
- Skill tags: PLAYTEST, UX-A11Y

## Dependencies

- IRPG-204 수치 밸런스 기준선
- IRPG-403 접근성 감사
- IRPG-504 실제 브라우저 전체 흐름

## Acceptance criteria

- Given 외부 사용자 10명 이상일 때, when 신규 저장에서 실시간으로 첫 환생 관문까지 플레이하면, then 첫 전투·강화·보스·패배·30스테이지 시각과 선택 이유를 기록한다.
- Given 전체 기록일 때, when 결과를 집계하면, then 진행 차단과 데이터 손실은 0건이고 관문 도달 중앙값은 30~45분이다.
- Given 이해하지 못한 숫자·용어와 이탈·불만 기록일 때, when Review를 수행하면, then 재현 가능한 제품·접근성·밸런스 후속 티켓으로 분류한다.
- 자동 가속 시뮬레이션이나 에이전트 세션을 외부 사용자 증거로 대체하지 않는다.
