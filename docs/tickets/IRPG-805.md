# IRPG-805 — 전장 Floating HUD 폴리시 (머리 위 체력바 & 실데이터 원형 스킬 닷)

## Outcome

《Raid: Shadow Legends》 전장 스크린샷을 참조해, 영웅·동료·적 머리 위에 뜨는 이름/체력 라벨과 실제 쿨다운에 연동된 원형 스킬 버튼을 전장 캔버스 위에 배치하여, 기존 로직·수치·판정은 그대로 둔 채 시네마틱 몰입감만 끌어올린다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Draft
- Skill tags: FE-GAME, UX-FEEDBACK, ART-2D, QA-E2E
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- `src/components/TacticalCardStage.tsx`: 영웅/동료/적 스프라이트 **바로 위**에 소형 플로팅 이름표+체력바(`FloatingCombatantTag` 등 신규 하위 컴포넌트)를 추가한다. 현재 스프라이트 **아래**에 있는 카드형 `StatBar`(`tactical-actor__copy` 블록)는 정보 접근성을 위해 유지하지 않고 이 플로팅 태그로 대체한다(정보 중복 방지, 화면을 Raid처럼 비워 보이게 하는 것이 목적).
- `src/components/TacticalActionBar.tsx`가 이미 계산해 갖고 있는 실제 스킬 슬롯 상태(`state.player.skillSlots`, `state.battle.powerStrikeCooldownMs`, `state.battle.companionCooldownMs`)를 사용해, 전장 캔버스 우하단에 겹쳐지는 원형 스킬 버튼 레이어(`FloatingSkillDock.tsx` 신규)를 추가한다. 쿨다운은 실제 밀리초 값으로 원형 반시계 방향 셰이더를 채운다.
- 고아 상태이던 `src/components/DirectHotbar.tsx`(항상 0으로 고정된 가짜 쿨다운, 아무 곳에서도 import되지 않음)는 이 티켓에서 **삭제**하고, 위 `FloatingSkillDock.tsx`가 실제 데이터로 그 자리를 대신한다.
- 기존 `TacticalActionBar.tsx`의 8슬롯 명령(성장/동료/회복 등, IRPG-424)은 그대로 두고 건드리지 않는다 — 이 티켓은 "전투 중 스킬 발동" 원형 버튼만 캔버스 위로 끌어올리는 것이지 액션바 전체를 대체하는 게 아니다.

## Non-scope

- **라운드 카운터·타이머**("1/3 라운드", "0:03") — Emberwatch는 실시간 자동전투(1초 간격 combat round)이지 Raid식 턴제 파티 전투가 아니라서, 이 개념을 억지로 이식하지 않는다.
- **3v3 파티 대형** — Emberwatch는 영웅 1 + 동료 1 vs 적 1 구도라서 다중 유닛 배치는 대상이 없다.
- **배속(x1/x2) 토글, "자동전투" on/off 버튼** 같은 신규 플레이어 기능 — 순수 시각 변경 범위를 넘는 신규 기능이므로 별도 제품 논의 없이 만들지 않는다.
- 전투 판정·수식·이벤트 스트림 변경 (이미 IRPG-416/422로 Done, 이번 티켓은 프레젠테이션만).

## Dependencies

- IRPG-416 (동적 전투 연출·비노출 전투 손상), IRPG-422 (전술 전장 단일화·전투 슬롯바), IRPG-424 (8슬롯 명령 재배치), IRPG-506 (시각 회귀 게이트)

## Impacts

- Save schema: none
- Content config: none
- Accessibility: review 필요 — 플로팅 태그가 스크린리더 흐름을 방해하지 않도록 `aria-hidden`과 기존 `StatBar`의 `role="progressbar"` 접근성 정보를 신설 위치로 온전히 이전해야 한다(정보 손실 금지).

## Acceptance criteria

- Given 전투 화면, when 영웅/동료/적이 렌더링되면, then 각 스프라이트 머리 위에 실제 `currentHp`/`maxHp`에서 산출한 체력바와 이름이 표시된다(가짜 수치 없음).
- Given `state.battle.powerStrikeCooldownMs > 0`, when 원형 스킬 버튼을 보면, then 실제 남은 쿨다운 비율만큼 셰이더가 채워지고, 기존 `TacticalActionBar`가 보여주는 초 단위 숫자와 정확히 일치한다.
- Given 스크린리더 사용자, when 전투 화면을 순회하면, then 체력 정보가 기존과 동일하게(또는 더 낫게) `role="progressbar"`로 노출되고 정보가 유실되지 않는다.
- Given `DirectHotbar.tsx` 삭제, when 전체 코드베이스를 검색하면, then 어디에서도 참조되지 않는다(이미 고아 상태였음을 재확인).
- Given `npm run test:e2e:visual`, when 새 플로팅 HUD 상태의 baseline을 추가하면, then Ubuntu CI에서 안정적으로 통과한다.

## Design

- 정보 이전 원칙: 머리 위로 옮기는 정보(이름/체력)는 기존 하단 카드에서 "삭제"가 아니라 "이동"이다 — 접근성 속성(`aria-label`, `role="progressbar"`, `aria-valuenow` 등)을 새 위치의 마크업으로 그대로 옮긴다.
- 원형 스킬 버튼은 새 상태를 만들지 않고 `TacticalActionBar.tsx`가 이미 파생해 둔 쿨다운/장착 여부 값을 props로 전달받아 그린다(중복 계산 금지).

## Verification

- 코드 리뷰: 신규 컴포넌트가 새 engine 상태나 새 계산식을 만들지 않고 기존 파생값만 재사용하는지 확인.

## Test evidence

- `src/components/TacticalCardStage.test.tsx` / `FloatingSkillDock.test.tsx` (신규)
- `npm run verify` (Playwright 시각 회귀 포함) 통과 로그
