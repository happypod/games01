# IRPG-206 — 환생 후 최고점 재도달 튜닝

## Outcome

첫 환생의 영구 보너스가 체감 가능한 재진행 가속을 만들면서 첫 원정 30~45분 기준선을 깨지 않는다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Draft
- Skill tags: GD-BAL, PLAYTEST, QA-DOMAIN

## Dependencies

- IRPG-203 환생·영구 성장
- IRPG-204 첫 환생 밸런스 기준선
- IRPG-104 저장 가능한 RNG·치명타

## Acceptance criteria

- Given IRPG-204와 같은 10개 seed·성장 전략일 때, when 첫 환생 전후의 30스테이지 도달 시간을 비교하면, then 재도달 시간 중앙값은 첫 원정의 50~70%다.
- Given 각 세션일 때, when 환생과 재도달을 반복 실행하면, then 정수 지급·초기화·RNG 연속성과 최종 상태가 결정론적이다.
- Given 튜닝 뒤일 때, when IRPG-204 회귀를 실행하면, then 첫 원정 중앙값 30~45분과 장기 1.15 HP 곡선은 유지된다.

## Discovery evidence

- IRPG-204 리뷰의 동일 seed 교차 계측은 재도달 중앙값 약 74.4%, 범위 63.9~79.2%, 10회 중 8회가 70% 상한을 초과했다.
