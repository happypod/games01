# IRPG-413 — 일반 적·보스 일러스트 세트

## Outcome

현재 일반 적 5종과 보스 3종이 각 안정 ID의 일러스트로 표시되고 이미지 실패에도 적 이름·HP·boss 상태가 유지된다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK
- Owner / Reviewer: unassigned / art direction and accessibility reviewers

## Scope

- 일반 적 archetype 5개와 보스 3개 portrait
- current enemy panel 연결과 boss emphasis
- 360px·데스크톱 crop, loading·error fallback, 최적화

## Non-scope

- 신규 적 능력·패턴·전투 수식
- 영웅·장비 외형, 스킨·가챠, 프레임 애니메이션
- 승리·패배 결과 화면

## Dependencies

- IRPG-102 현재 적·보스 content
- IRPG-403 접근성 기준선
- IRPG-406 asset manifest

## Impacts

- Save schema: none
- Content config: 기존 적·보스 stable visual ID의 placeholder를 final asset으로 교체
- Accessibility: 텍스트 이름이 권위 정보이며 decorative art가 알림을 중복하지 않음

## Acceptance criteria

- Given 등록된 적·보스일 때, when 해당 전투를 열면, then 각 안정 ID의 올바른 일러스트와 기존 이름·boss 상태가 함께 표시된다.
- Given 자산 누락·decode 실패·느린 load일 때, when 전투가 진행되면, then fallback이 크기 이동 없이 표시되고 전투·저장이 중단되지 않는다.
- Given 360×800·1440×900·200% 확대일 때, when 일반 적과 boss 화면을 확인하면, then HP·이름·스테이지 이동을 가리거나 가로 overflow를 만들지 않는다.
- Given production build일 때, when asset budget을 검사하면, then 모든 portrait가 manifest의 768×768 WebP·250 KiB 상한과 lazy-load 계약을 통과한다.

## Design

기존 `EnemyDefinition.assetId`를 유지하고 이름과 수치는 HTML 텍스트로 표시한다. 비현재 전투 대상은 첫 화면에서 요청하지 않는다.

## Verification

- 예정: 8개 콘텐츠 매핑, crop 일관성, 대비·fallback과 bundle 예산 Review.

## Test evidence

- 예정: mapping 단위 테스트와 enemy/boss Playwright screenshot.
