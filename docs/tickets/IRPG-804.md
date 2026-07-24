# IRPG-804 — 동료화·캠프 크래프팅·합동 연성(교배) 확장

## Outcome

포획한 생체카드(`isCaptured: true`)를 캠프 동료로 전환하거나, 재료 생산(크래프팅)에 기여시키거나, Sera의 "합동 연성" 패턴을 일반화한 교배(연성) 시스템으로 활용할 수 있게 된다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft (Ready 전환 보류 — 아래 미해결 질문 참조)
- Skill tags: PROD-LOOP, GD-BAL, ENG-STATE, NARRATIVE
- Owner / Reviewer: Lead Builder / Project Owner

## Scope (예비)

- 포획된 생체카드를 `CompanionId` 로스터로 전환하는 경로 (또는 별도 `CampResidentId` 확장 — 아래 미해결 질문 1 참조)
- 포획 개체를 캠프 재료 생산(크래프팅 기여)에 연결
- `CAMP_JOINT_SYNTHESIS_DEFINITIONS`/`synthesizeJointBond` 패턴을 일반화해 생체카드 간 합동 연성(교배)으로 확장
- `corruptionLevel`의 실제 의미와 결정론적 수식 정의 (IRPG-801에서는 `0`으로만 유지됨)

## Non-scope

- 이 문서 자체에서 수식·UI를 확정하지 않는다 — 아래 미해결 질문에 대한 답이 나온 뒤 별도 Ready 티켓으로 분할한다.

## Dependencies

- IRPG-801 (결정론적 포획 엔진) — Done 필요
- IRPG-802 (LivingCardConsole 실데이터 연동) — Done 필요
- IRPG-803 (2.5D 캠프 오브젝트 캔버스) — 포획 개체를 캠프에 시각적으로 배치하려면 필요
- IRPG-427 (결정론적 합동 연성 비용·수집 보상·중복 방지) — 재사용할 기존 패턴

## Impacts

- Save schema: migration required (예상) — 아직 필드 미확정
- Content config: changed (예상)
- Accessibility: review required (예상)

## Acceptance criteria

- (미정 — Ready 전환 시 작성)

## Design — 미해결 질문 (Ready 전환 전 Owner 답변 필요)

1. 포획한 인간형 개체를 "동료(Companion)"로 편입할 때, 기존 `CHAPTER1_ADULT_CHARACTER_DEFINITIONS`의 캐릭터별 `consentRequired` 패턴(IRPG-800 참조)을 그대로 승계하는가? 즉 사람형 포획 개체도 Sera처럼 "구조 → 별도 동의 → 유대" 흐름을 거치는가, 아니면 다른 흐름인가?
2. 교배(연성) 결과물은 무엇인가 — 새 장비 카드(IRPG-427과 동일), 신규 동료, 소모성 재료 중 무엇을 생성하는가?
3. "타락 농도(`corruptionLevel`)"가 실제로 어떤 게임플레이 효과를 주는가 (스탯 보정, 해금 조건, 단순 연출용 지표 등)?
4. 야수형 포획 개체는 동료가 아니라 캠프 생산 자원(사육/크래프팅 기여)으로만 쓰이는가, 아니면 전투 동료도 될 수 있는가?
5. 작업 크기가 2~3일을 넘지 않도록 몇 개의 하위 티켓(IRPG-805+)으로 쪼갤 것인가?

## Verification

- 해당 없음 (Draft, 구현 전)

## Test evidence

- 해당 없음
