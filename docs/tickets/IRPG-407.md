# IRPG-407 — 영웅·적·보스 일러스트 세트

## Outcome

영웅 1명과 현재 적 5종·보스 3종이 일관된 세계관의 일러스트로 표시되고 이미지 실패에도 전투 정보가 유지된다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK
- Owner / Reviewer: unassigned / art direction and accessibility reviewers

## Scope

- 영웅 portrait 1개, 일반 적 archetype 5개, 보스 3개
- current enemy·hero panel 연결과 boss emphasis
- 360px·데스크톱 crop, loading·error fallback, 최적화

## Non-scope

- 신규 적 능력·패턴·전투 수식
- 장비 외형 조합, 스킨·가챠, 프레임 애니메이션
- 승리·패배 결과 화면

## Dependencies

- IRPG-102 현재 적·보스 content
- IRPG-403 접근성 기준선
- IRPG-406 asset manifest

## Impacts

- Save schema: none
- Content config: existing enemy definitions receive asset IDs
- Accessibility: text name remains authoritative; decorative art does not duplicate announcements

## Acceptance criteria

- Given 등록된 영웅·적·보스일 때, when 전투 화면을 열면, then 각 안정 ID의 올바른 일러스트와 기존 이름·boss 상태가 함께 표시된다.
- Given 자산 누락·decode 실패·느린 load일 때, when 전투가 진행되면, then fallback이 크기 이동 없이 표시되고 명령·전투·저장은 중단되지 않는다.
- Given 360×800·1440×900·200% 확대일 때, when hero와 boss 화면을 확인하면, then 핵심 HP·명령·이름을 가리거나 가로 overflow를 만들지 않는다.
- Given production build일 때, when asset budget을 검사하면, then manifest의 포맷·픽셀·바이트 상한을 통과한다.

## Design

전투 규칙은 기존 `EnemyDefinition`을 유지하고 시각 ID만 추가한다. 이름과 수치는 HTML 텍스트로 유지하며 이미지는 정보 전달의 유일한 수단이 아니다.

## Verification

- 8개 콘텐츠 매핑, crop 일관성, 대비·fallback과 bundle 예산을 Review한다.

## Test evidence

- 예정: mapping 단위 테스트와 hero/enemy/boss Playwright screenshot
