# IRPG-409 — 장비·스킬 일러스트 카드

## Outcome

무기·갑옷·부적과 현재 스킬 3종이 일러스트 카드로 표시되며 현재/다음 효과·비용·잠금·최대 상태를 한눈에 이해한다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK
- Owner / Reviewer: unassigned / game UI and accessibility reviewers

## Scope

- 고정 장비 강화 트랙 3종과 스킬 3종의 카드 자산
- 현재 효과, 다음 단계 차이, 비용, 잠금·구매 가능·MAX 표시
- 기존 구매 명령·비용 함수 연결과 실패 fallback

## Non-scope

- 랜덤 아이템·드롭·등급·인벤토리·장착 교체
- 신규 스킬 효과, 비용·보상 밸런스 변경
- 카드 뽑기·상점 결제

## Dependencies

- IRPG-201 장비 성장
- IRPG-202 스킬 성장
- IRPG-403 접근성 기준선
- IRPG-406 asset manifest

## Impacts

- Save schema: none
- Content config: existing equipment and skills receive asset IDs and display deltas
- Accessibility: visible and screenreader purchase state required

## Acceptance criteria

- Given 장비·스킬 상태일 때, when 카드를 렌더링하면, then 이미지·이름·현재/다음 효과·비용·잠금/구매/MAX가 기존 수식과 일치한다.
- Given 구매 가능·1 부족·정확히 일치·최대 단계일 때, when 버튼을 사용하면, then 기존 engine 명령만 호출하고 실패 시 자원·랭크가 변하지 않는다.
- Given 이미지 실패일 때, when 카드를 사용하면, then glyph·텍스트 fallback과 모든 구매 명령이 유지된다.
- Given 360px·키보드·스크린리더·200% 확대일 때, when 6개 카드를 순회하면, then 상태·비용·비활성 사유가 잘리지 않고 focus 순서가 예측 가능하다.

## Design

“아이템”은 검증된 고정 강화 트랙에 한정한다. 효과 수치는 UI에 복제하지 않고 기존 formula selector에서 파생한다.

## Verification

- 6개 카드 mapping, 비용·효과 단일 출처, 잠금·MAX·fallback을 Review한다.

## Test evidence

- 예정: 카드 상태 컴포넌트 테스트와 모바일 구매 Playwright 흐름
