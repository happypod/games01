# IRPG-107 — 결정론적 원정 선택 이벤트

## Outcome

로컬 원정에서 선택형 이벤트가 전투를 중단하지 않고 나타나며, 저장·reload·오프라인 뒤에도 선택 보상이 한 번만 적용된다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Ready
- Skill tags: PROD-LOOP, ENG-STATE, ENG-SAVE
- Owner / Reviewer: unassigned / product and save reviewers

## Scope

- 데이터 기반 로컬 이벤트 정의와 안정적인 event ID
- 최고 stage milestone·seed·환생 회차로 결정되는 선택 카드
- 전투 RNG draw를 소비하지 않는 독립 event substream
- 최대 3개 pending event, 버전·수치가 검증된 선택 효과, 원자적 선택 명령과 현재 원정 milestone mask
- state schema migration, legacy fixture, A/B·portable backup 호환

## Non-scope

- 시즌·출석·시간제·서버 라이브 이벤트
- 퀘스트 체계, 랜덤 인벤토리, 결제·광고 보상
- 전투 일시 정지나 강제 modal

## Dependencies

- IRPG-106 전투 이벤트 스트림
- IRPG-206 환생 후 재도달 밸런스 기준선
- IRPG-303 migration registry
- 이벤트 발동 빈도·보상 상한 제품 승인

## Impacts

- Save schema: migration required
- Content config: local event definitions added
- Accessibility: 선택 카드 Review required

## Acceptance criteria

- Given 같은 저장 상태·seed·최고 stage·환생 회차일 때, when milestone을 통과하면, then 같은 event ID와 선택지가 한 번만 pending에 추가된다.
- Given 같은 전투 상태일 때, when event milestone을 통과하거나 선택지를 만들면, then 전투 RNG state·draw count는 변하지 않고 event substream만 같은 결과를 만든다.
- Given pending event일 때, when 선택 명령이 성공하면, then safe-integer 효과 적용과 pending 제거가 한 transaction으로 적용되고 이미 소비된 milestone bit는 유지되어 반복 클릭·reload로 재지급되지 않는다.
- Given pending이 3개일 때, when 새 milestone을 통과하면, then 해당 bit를 소비하고 보상 없이 overflow를 집계해 이후 pruning·stage 재선택으로 다시 발동하지 않는다.
- Given 이벤트 정의가 배포 사이에 바뀔 때, when 기존 pending을 선택하면, then pending에 저장된 `definitionVersion`과 resolved choice effects가 적용되어 보상 내용이 바뀌지 않는다.
- Given pending이 남은 채 환생할 때, when 환생 명령이 성공하면, then pending은 보상 없이 폐기되고 증가한 환생 회차의 새 30-bit milestone mask가 0에서 시작한다.
- Given legacy·A/B·portable 저장일 때, when migration·왕복·오프라인을 수행하면, then pending/completed 계약과 RNG 결정론이 유지된다.
- Given resolved effect가 음수·NaN·미지원 type이거나 재화가 최대 안전 정수 경계일 때, when decode·선택 명령을 수행하면, then 잘못된 pending은 거부하고 유효 효과는 기존 포화 helper로 적용해 저장 가능한 상태를 유지한다.
- Given 승인된 첫 3개 이벤트의 최소·최대 효과일 때, when IRPG-204·206 회귀를 실행하면, then 첫 환생 30~45분과 재도달 50~70% 기준이 모두 유지된다.

## Design

이벤트는 원정 중 선택 가능한 로컬 콘텐츠이며 실시간 운영 이벤트가 아니다. event substream은 `hash(saved seed, stats.prestiges, milestone index, definition version)`에서 만들며 전투 RNG를 advance하지 않는다. 저장 상태는 `{ runPrestige, milestoneMask, pending, overflowCount }`처럼 bounded하게 유지한다. `milestoneMask`는 stage 10~300의 30개 milestone을 나타내는 현재 원정의 유일한 완료·waive 표식이며 별도 completed ID ledger를 두지 않는다. milestone 통과 시 bit 설정과 pending 추가 또는 overflow 집계를 한 transaction으로 처리하므로 pending pruning 뒤에도 같은 원정의 보상이 다시 열리지 않는다.

pending entry는 `eventId·definitionId·definitionVersion·milestoneIndex·resolvedChoices`를 저장한다. resolved effect는 승인된 type whitelist와 non-negative safe-integer operand만 허용하고 지급 시 `toSafeInteger`·`addSafeIntegers` 계열 포화 helper를 사용한다. 정의가 바뀌어도 이미 제시한 선택의 효과는 바뀌지 않는다. pending 카드는 전투를 멈추거나 포커스를 강제로 가져가지 않는다. 보상은 `chooseExpeditionEvent` 명령만 지급하며 UI·reload·표시 이벤트는 지급하지 않는다.

Draft를 Ready로 옮기기 전에 발동 milestone, 첫 이벤트 정의 3개, 보상 상한, resolved effect schema, 환생 시 pending 폐기 문구, migration·downgrade fence와 IRPG-204·206 balance fixture를 제품·저장 리뷰에서 확정한다.

## Approved product contract (2026-07-19)

- 현재 원정의 `highestStage`가 10·20·…·300에 처음 도달해 해당 stage에 진입할 때 30-bit milestone을 소비한다. 이전 stage 재선택이나 같은 boss 재처치로 다시 열리지 않는다.
- milestone 3개 단위 block마다 `event.ember-shrine`, `event.wandering-smith`, `event.ash-camp`를 정확히 한 번씩 배치하는 deterministic shuffle-bag을 사용한다. `hash(savedSeed, runPrestige, blockIndex, "expedition-definitions-v1")`에서 만든 임시 `xorshift32-v1` substream만 사용하며 전투 RNG state와 draw count는 바꾸지 않는다.
- canonical ID는 `expedition-v1:{seedHex}:{runPrestige}:{milestoneIndex}:{definitionId}`, `definitionVersion`은 1이며 선택지 순서는 고정한다.
- `n = milestoneStage / 10`일 때 resolved choice effect는 아래 두 종류 중 하나만 저장한다.
  - 불씨 성소: `3 × n` 골드(최대 90) 또는 발동 당시 최대 HP의 20% 회복량
  - 떠돌이 대장장이: `5 × n` 골드(최대 150) 또는 발동 당시 최대 HP의 10% 회복량
  - 잿빛 야영지: `2 × n` 골드(최대 60) 또는 발동 당시 최대 HP의 25% 회복량
- effect whitelist는 `grantGold`와 `restoreHp`뿐이다. 정수·경험치·스킬 포인트·무료 강화·영구 효과는 제외한다. 골드는 실제 포화 증가량만 `stats.goldEarned`에 더하고 HP는 선택 시점의 현재 최대 HP를 넘지 않는다.
- pending은 최대 3개다. 가득 찬 상태의 새 milestone은 bit를 소비하고 `overflowCount`만 올리며, 자리가 생겨도 재발동하거나 보상하지 않는다.
- 선택은 effect 적용과 pending 제거를 하나의 순수 transaction으로 처리한다. 없는 event·choice, 잘못된 effect, 중복 클릭은 입력 객체를 그대로 반환하고 자원·RNG·mask를 바꾸지 않는다.
- 환생 확인 문구는 `환생하면 대기 중인 원정 이벤트 {N}개가 보상 없이 사라집니다.`이며 성공하면 새 run의 mask·pending·overflow를 0으로 초기화한다. `stats.prestiges === Number.MAX_SAFE_INTEGER`에서는 동일 run ID 재사용과 보상 복제를 막기 위해 환생을 거부한다.
- 저장은 schema 5로 올린다. schema 1~4 migration은 현재 `stats.prestiges`를 run으로 복사하고 `highestStage` 이하 milestone을 모두 소비한 mask, 빈 pending, overflow 0으로 만든다. 소급 이벤트는 지급하지 않는다. malformed schema 5는 전체 저장을 거부해 다른 A/B slot으로 fallback하며 future schema downgrade overwrite는 계속 차단한다.
- 정확히 한 번 지급의 범위는 선택된 로컬 A/B 저장 계보다. 과거 portable backup 복원은 pending과 이미 지급된 자원을 함께 rollback할 수 있으며 서버 권위 중복 방지는 범위 밖이다.
- Ready balance fixture는 선택 보류 경로의 기존 exact timing, 첫 두 이벤트 4개 선택 조합, 10개 seed × 솔로/동료 paired session을 고정한다. 모든 첫 환생은 30~45분, 재도달은 50~70%, 60분 내 20/20 도달, 전투 RNG 무변경과 반복 hash 일치를 통과해야 한다. 70%를 넘으면 회복률을 5%p 단위로 먼저 낮추고 이후 골드 계수를 낮춘다.

legacy migration은 현재 환생 회차를 `runPrestige`로 설정하고 `highestStage` 이하의 milestone bit를 보상 없이 소비된 상태로 초기화한다. 따라서 업데이트 전에 통과한 milestone을 소급 지급하거나 낮은 stage를 재선택해 다시 여는 일이 없다.

## Verification

- 제품 범위, 보상 복제 방지, pending 상한, migration downgrade fence를 Review한다.

## Test evidence

- 예정: command 원자성·중복 방지·MAX_SAFE effect·legacy mask migration·A/B·portable fixture·브라우저 reload 회귀
