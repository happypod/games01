# IRPG-417 — 전술 전장 연출 가시성·원정 오버레이 접기

## Outcome

사용자가 저장된 원정 이벤트가 있는 유형 2 화면을 열어도 캐릭터·적·전투 연출을 즉시 보고, 원할 때만 원정 선택 오버레이를 펼치며 월식의 기사 갑옷 손상 단계를 텍스트로 확인한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Verify
- Skill tags: FE-GAME, UX-FEEDBACK, QA-E2E
- Owner / Reviewer: Codex / independent UX and accessibility review

## Scope

- 유형 2가 저장된 pending 원정 이벤트와 함께 mount·reload·layout 전환될 때 전장을 기본으로 노출
- 대기 건수가 포함된 44px 이상의 토글로 원정 선택 오버레이를 열고 닫기
- 새 원정 이벤트는 전장을 가리거나 focus를 옮기지 않고 토글의 대기 건수로 알리기
- 실제로 열린 오버레이만 전장 명령과 시각 연출을 일시 정지하고, 접힌 pending 상태에서는 자동 전투 연출 유지
- 마지막 선택 카드가 사라지면 기존 전장 제목 focus 복원과 exact-once 선택 계약 유지
- 유형 1·2의 월식의 기사 Normal·Damaged·Severe 초상에 `갑옷 온전`·`갑옷 균열`·`갑옷 붕괴 직전` 설명 표시
- 360×800, 1440×900, 200% 확대, 키보드, 모션 감소 및 canonical screenshot 회귀 검증

## Non-scope

- 게임 엔진, 전투 수식, RNG, 보상, 원정 이벤트 생성·선택 효과 변경
- `GameState`, A/B slot, portable save schema, revision 또는 migration 변경
- pending 이벤트 자동 선택·폐기·순서 변경 또는 대기 한도 변경
- 노출, 성적 의상 파손, 성적 승패 장면, 혈액·고어
- 신규 시각 자산 또는 asset manifest 변경

## Dependencies

- IRPG-403, IRPG-412, IRPG-415, IRPG-416, IRPG-506
- 원정 선택 exact-once, 전투 scene queue, 유형 2 전술 전장 및 HP 기반 갑옷 손상 selector 계약

## Impacts

- Save schema / migration / revision: none
- Game engine / formulas / deterministic RNG: none
- Content config: 저장되지 않는 presentation damage-state selector와 표시 문구만 추가
- Asset manifest: none
- Accessibility: 토글의 `aria-expanded`·`aria-controls`, 열린 오버레이의 region 이름, 44px 조작 영역, inert 범위와 마지막 카드 focus 복원을 재검증

## Acceptance criteria

- Given pending 원정 이벤트가 저장된 상태, when 유형 2를 mount·reload하거나 유형 1에서 전환하면, then 오버레이는 접혀 있고 영웅·적·동료·전투 HUD가 즉시 보이며 전장 base는 inert가 아니다.
- Given 접힌 pending 이벤트가 있을 때, when 사용자가 `원정 이벤트 N건 보기`를 누르면, then 같은 위치의 토글이 `전투 화면 보기`로 바뀌고 선택 카드가 표시되며 전장 base만 inert가 된다.
- Given 오버레이가 열려 있을 때, when 사용자가 `전투 화면 보기`를 누르면, then 카드는 숨고 전장 명령과 새 전투 연출이 다시 활성화된다.
- Given 유형 2가 열린 채 pending 수가 0에서 1 이상으로 증가할 때, when 새 이벤트가 도착하면, then 오버레이를 자동으로 열거나 focus를 빼앗지 않고 토글의 대기 건수만 갱신한다.
- Given 오버레이가 열린 동안 새 전투 scene이 도착할 때, when 오버레이를 닫거나 마지막 카드를 해결하면, then 가려진 scene을 뒤늦게 재생하지 않는다.
- Given 마지막 원정 카드를 선택했을 때, when pending 수가 0이 되면, then 토글과 오버레이가 사라지고 focus가 전장 제목으로 복원되며 선택 명령은 이벤트당 한 번만 호출된다.
- Given 월식의 기사 HP가 70% 이상, 30% 이상 70% 미만, 30% 미만일 때, when 유형 1 또는 유형 2를 보면, then 각각 `갑옷 온전`, `갑옷 균열`, `갑옷 붕괴 직전`이 해당 초상과 함께 표시된다.
- Given 비대상 적 또는 잘못된 HP 값일 때, when 전투 화면을 렌더하면, then 갑옷 손상 문구를 추가하지 않고 기존 기본 초상과 전투를 유지한다.
- Given 360×800, 1440×900, 200% 확대 또는 모션 감소 환경, when 접힌 상태와 열린 상태를 오가면, then 토글·주요 HUD·선택 카드가 잘리거나 가로 overflow가 생기지 않는다.
- Given IRPG-506 canonical 68개 기준선을 실행할 때, when 변경을 비교하면, then pending 전장이 기본 노출되는 `visual.events.tactical-overlay` 4개만 의도적으로 갱신되고 나머지 64개는 유지된다.

## Design

오버레이의 열림 여부는 `TacticalStage` 내부의 비영속 React 상태로만 둔다. mount·reload·layout 전환과 같은 mount 수명 중 새 이벤트 도착 모두 자동으로 열지 않으므로 전장 관전을 방해하지 않는다. pending 건수 변화는 같은 토글의 가시적 문구로 알리고 사용자가 닫은 상태를 보존한다.

토글은 inert가 적용되는 전장 base 밖에 같은 DOM 노드로 유지한다. 열린 상태에서만 `useTacticalStageEffects`를 비활성화하고 base에 inert를 적용한다. 따라서 선택 카드가 저장되어 있다는 이유만으로 전투 scene을 숨기지 않으며, 열린 동안 소비된 scene은 기존 queue 계약대로 다시 재생하지 않는다.

갑옷 손상 문구는 저장 필드가 아니라 기존 유효 HP selector에서 파생한다. 월식의 기사 이외에는 `null`을 반환하고 70%·30% 경계는 IRPG-416 초상 규칙과 동일하게 유지한다.

## Verification

- 구현 전 실제 브라우저 감사에서 오프라인 보고서 확인 후 저장된 pending 2건 오버레이가 유형 2 전장을 완전히 덮고, `useTacticalStageEffects`도 pending 존재만으로 비활성화되는 원인을 재현했다.
- Review: 독립 시각 감사에서 핵심 전장 가시성은 통과했다. 1280px 실제 DOM 측정에서 `body/html scrollWidth === clientWidth`를 확인해 우측 잘림 후보를 해소했고, 360px의 작은 BOSS/CTA 간격과 기존 중복 치명타 강조만 비차단 P2로 기록했다.
- Review: 독립 정적 검토가 reader의 1초 combat generation 재시드, 열린 상태에서 신규 pending 합류, 외부 focus 탈취 가능성을 P1으로 발견했다. 열림 ID 수명과 focus 전이를 수정하고 두 차례 재검토하여 최종 P0/P1 없음 판정을 받았다.
- Verify: `GameState`, A/B schema·revision, migration, 공식·RNG·보상 명령은 변경하지 않았다. `npm run verify`에서 lint, strict TypeScript, Vitest 42파일·353테스트, manifest 33테스트, 30 asset ID validator와 production build가 통과했다.

## Test evidence

- 일반 Playwright 55/55와 production cold-load 5/5가 통과했다. 저장 pending 전장 노출→3건 열기→rapid exact-once 선택→전장 복귀, 유형 1·2 damage label, 360×800 44px 토글·페이지 overflow를 포함한다.
- 실제 저장 화면에서 접힌 상태의 영웅·동료·적·VFX·`갑옷 균열`·`원정 이벤트 2건 보기`를 확인했고, 열기/닫기 시 overlay 1→0, base inert on→off, 선택 미실행을 확인했다.
- Ubuntu canonical 68개 비교와 의도된 `visual.events.tactical-overlay` 4개 baseline 교체는 GitHub Actions artifact 수용 후 Test 단계에서 기록한다.

- 자동·브라우저·canonical screenshot 결과는 Test 단계에서 기록한다.
