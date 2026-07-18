# IRPG-409 — 장비·스킬 일러스트 카드

## Outcome

무기·갑옷·부적과 현재 스킬 3종이 고유 일러스트 카드로 표시되며 현재/다음 효과·비용·잠금·최대 상태를 한눈에 이해한다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Ready
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK
- Owner / Reviewer: Codex / independent game UI, art, and accessibility reviewers

## Scope

- 고정 장비 강화 트랙 3종과 스킬 3종의 고유 카드 자산
- 현재 효과, 다음 단계 차이, 비용, 잠금·구매 가능·MAX 표시
- 기존 구매 명령·비용 함수 연결, 지연 로드와 실패 fallback
- IRPG-506 혼합 상태와 fallback 시각 fixture

## Non-scope

- 랜덤 아이템·드롭·등급·인벤토리·장착 교체
- 신규 스킬 효과, 비용·보상 밸런스 변경
- 카드 뽑기·상점 결제

## Dependencies

- IRPG-201 장비 성장 — Done
- IRPG-202 스킬 성장 — Done
- IRPG-403 접근성 기준선 — Done
- IRPG-406 asset manifest — Done
- IRPG-506 visual regression harness — Done

## Impacts

- Save schema: none; `SAVE_VERSION = 3` 유지, migration 없음
- Content config: 기존 장비·스킬 정의에 비영속 asset ID 추가
- Formula: 기존 `getHeroStats`와 비용 수식으로 현재/다음 표시값만 순수 파생
- RNG / combat / rewards: none
- Accessibility: 장식 이미지는 접근성 트리에서 제외하고 상태·효과·비활성 사유를 HTML로 제공

## Fixed content mapping

- `weapon → equipment.ember-blade`
- `armor → equipment.guard-armor`
- `charm → equipment.fortune-charm`
- `powerStrike → skill.power-strike`
- `ironWill → skill.iron-will`
- `fortune → skill.loot-sense`

asset ID와 이미지 활성화 여부는 `GameState`·portable backup에 저장하지 않는다.

## Formula and state contract

- UI에 강화 계수를 복제하지 않는다. 순수 selector가 현재 상태와 `min(current + 1, max)` 가상 상태의 `getHeroStats` 결과를 비교한다.
- 무기는 최종 공격력, 갑옷과 강철 의지는 최종 최대 HP·방어력, 부적과 전리품 감각은 최종 골드 획득 보너스, 화염 강타는 최종 피해 배율을 표시한다.
- 화염 강타 rank 0의 현재 효과는 `비활성`이다. MAX는 다음 효과와 비용이 없다.
- 장비 상태 우선순위는 `MAX → 전역 비활성 → 자원 부족 → 구매 가능`이다.
- 스킬 상태 우선순위는 engine 검사와 같은 `잠김 → MAX → 전역 비활성 → SP 부족 → 구매 가능`이다.
- 카드 전체가 아닌 단일 native button만 기존 `purchaseUpgrade` 또는 `upgradeSkill` 명령을 호출한다.

## Asset contract

- 6종 모두 고유한 `512×512` 불투명 WebP, 각 `≤160 KiB`, `status: ready`, 고유 `src`·SHA-256을 사용한다.
- manifest에 생성기, prompt record, project-owned 권리 metadata를 기록한다.
- 핵심 실루엣은 중앙 64% 안전 영역에 두고 64px에서도 서로 구분되어야 한다.
- 이미지에는 글자·숫자·가격·등급·잠금·MAX·UI frame을 넣지 않는다.
- 카드가 viewport에 접근하기 전에는 `GameAsset`을 mount하지 않는다. 텍스트와 구매 조작은 항상 먼저 사용할 수 있어야 한다.
- 이미지 요청이나 decode가 실패해도 `fallback.card`, 이름, 효과, 상태, 구매 명령은 유지한다.

## Accessibility and responsive contract

- DOM과 읽기 순서는 무기 → 갑옷 → 부적 → 화염 강타 → 강철 의지 → 전리품 감각이다.
- 각 카드는 고유 heading으로 연결된 `article`이며 장식 이미지에는 대체 텍스트를 중복하지 않는다.
- 잠금·부족·MAX·읽기 전용 사유는 화면과 접근성 이름 모두에 나타난다. MAX 이름에는 비용을 읽지 않는다.
- 카드 자체에는 `tabIndex`를 추가하지 않고 실행 가능한 native button만 Tab 대상이다.
- 설명·효과·사유는 말줄임 없이 줄바꿈하며 360px·200% 확대에서도 가로 overflow가 없다.
- 모든 실행 버튼은 최소 `44×44px`이다.

## Acceptance criteria

- Given 장비·스킬 상태일 때, when 카드를 렌더링하면, then 고유 이미지·이름·현재/다음 효과·비용·잠금/구매/MAX가 기존 수식과 일치한다.
- Given 자원 `cost + 1`, `cost - 1`, `cost`, 잠금, MAX, 전역 비활성 상태일 때, when 포인터·Enter·Space를 사용하면, then 허용된 경우에만 기존 engine 명령이 정확히 한 번 실행된다.
- Given 명령이 거절될 때, then 자원·단계·RNG·save revision이 변하지 않는다.
- Given 카드가 초기 viewport 밖일 때, then 카드 WebP 요청은 0건이고 스크롤 후 고유 6종이 각각 한 번만 요청된다.
- Given 카드 WebP가 손상되었을 때, then `fallback.card`와 모든 텍스트·구매 명령이 유지된다.
- Given 360px·키보드·스크린리더·200% 확대일 때, when 6개 카드를 순회하면, then 효과·비용·비활성 사유가 잘리지 않고 focus 순서가 예측 가능하다.

## IRPG-506 visual fixtures

- `visual.cards.mixed-states`: 정확 구매·1 부족·잠금·MAX를 한 화면에 포함한다.
- `visual.cards.fallback`: 같은 상태에서 카드 WebP를 손상시켜 fallback을 고정한다.
- 두 fixture 모두 `.progression-panels`를 `360×800`, `1440×900`, reduced-motion 두 viewport에서 캡처한다. canonical baseline은 20개에서 28개가 된다.

## Verification

- Review: 6개 mapping, 수식 단일 출처, 상태 우선순위, 명령 단일 호출, 자산 안전 영역·권리를 독립 검토한다.
- Verify: 단위·컴포넌트·manifest·lint·typecheck·build와 `npm run verify`를 통과한다.
- Test: 360px·200%·키보드·lazy request·corrupt fallback Playwright와 28개 Ubuntu canonical visual regression을 통과한다.

## Test evidence

- 예정: 구현 후 로컬·GitHub CI run과 canonical artifact ID를 기록한다.
