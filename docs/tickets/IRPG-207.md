# IRPG-207 — 보스 최초 승리 보상 계약

## Outcome

승인된 보스 milestone 보상이 foreground·offline·reload·분할 실행에서도 최초 승리 한 번에만 원자적으로 지급된다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Draft
- Skill tags: GD-BAL, ENG-STATE, ENG-SAVE
- Owner / Reviewer: unassigned / product, balance, engine, and save reviewers

## Scope

- stage 10·20·30 등 보스 milestone별 versioned reward table
- bounded claimed milestone mask와 보상 지급의 단일 engine transaction
- 전체 save lifetime 동안 유지되고 환생이 명시적으로 복사하는 `claimedBossMilestoneMask`
- IRPG-106 `bossVictory` event에 이미 지급된 optional milestone reward snapshot 추가
- save schema migration, legacy fixture, A/B·portable backup·offline 호환
- 최대 안전 정수 포화와 reward claim 원자성

## Non-scope

- 랜덤 loot·inventory·가챠, 반복 파밍 보상, 결제·광고
- 결과 화면·일러스트·animation; IRPG-410이 확정된 snapshot만 표시
- 승인되지 않은 신규 재화나 서버 권위 보상

## Dependencies

- IRPG-106 결정론적 전투 이벤트 스트림
- IRPG-206 환생 후 재도달 밸런스 기준선
- IRPG-303 migration registry
- milestone별 보상 종류·수량 제품 승인

## Impacts

- Save schema: migration required
- Content config: versioned boss milestone reward table added
- Accessibility: none in engine ticket; IRPG-410에서 표시 검토

## Acceptance criteria

- Given 미수령 boss milestone일 때, when 최초 승리 상태 전이가 확정되면, then 승인된 보상과 claimed bit가 하나의 engine transaction에서 정확히 한 번 적용되고 event에 같은 snapshot이 들어간다.
- Given 이미 수령한 milestone일 때, when 재선택·재승리·reload·offline·단일/분할 실행을 수행하면, then 최초 승리 보상이 다시 지급되지 않는다.
- Given 보상 수령 뒤 환생할 때, when `performPrestige`와 저장 왕복 뒤 같은 boss를 다시 처치하면, then `claimedBossMilestoneMask`가 유지되어 보상이 재지급되지 않는다.
- Given 저장 도중 실패·A/B fallback·portable 왕복일 때, when 복구하면, then 보상과 claimed bit가 서로 어긋난 반쪽 상태를 선택하지 않는다.
- Given legacy 저장일 때, when migration하면, then 기존 최고 stage에 대한 소급 보상을 임의 지급하지 않고 승인된 migration 정책과 downgrade fence를 적용한다.
- Given `highestStage=300`인 legacy 저장일 때, when migration 뒤 stage 300을 재선택·재승리하거나 offline·A/B fallback을 수행하면, then 판별 불가능한 stage 300 보스 보상도 보수적으로 waived되어 지급되지 않는다.
- Given `stats.prestiges > 0`인 legacy 저장일 때, when 현재 `highestStage`가 낮아도 migration하면, then 과거 lifetime 최고점을 복원할 증거가 없으므로 30개 boss milestone 전체를 보수적으로 waived해 복제를 막는다.
- Given 보상이 최대 안전 정수 경계에 닿을 때, when 지급하면, then 재화는 안전 정수로 포화되고 claimed bit는 유지되어 overflow 재시도로 복제되지 않는다.
- Given 승인된 reward table일 때, when IRPG-204·206 회귀를 실행하면, then 첫 환생 30~45분과 재도달 50~70% 기준이 모두 유지된다.

## Design

보상 종류와 수량은 이 Draft에서 추론하지 않는다. Ready 전 제품 리뷰에서 고정 gold·skill point·cosmetic 중 실제 범위를 선택하고 신규 재화가 필요하면 별도 제품 티켓으로 분리한다. 보스 처치 상태 전이가 reward table을 조회해 claimed bit와 보상을 함께 갱신하는 유일한 지급 주체다. UI·event consumer·reload는 보상을 계산하거나 지급하지 않는다.

`claimedBossMilestoneMask`는 stage 10~300의 30개 bit로 제한한 lifetime 영속 필드다. `performPrestige`는 다른 영구 상태와 함께 이 mask를 그대로 복사하며 절대 초기화하지 않는다. migration은 `stats.prestiges === 0`이면 기존 `highestStage` 이하(`milestoneStage <= highestStage`)의 bit를 보상 없이 `waived/claimed`로 초기화한다. 현재 상태만으로 승리 여부를 구분할 수 없는 `highestStage=300`도 복제 방지를 우선해 stage 300 bit를 waived한다.

legacy `stats.prestiges > 0`은 과거 원정의 lifetime 최고 stage가 사라져 어떤 milestone이 이미 완료됐는지 복원할 수 없다. 이 경우 30개 bit 전체를 보수적으로 waived하고 신규 최초 보상을 소급 지급하지 않는다. 첫 migration 뒤 증거가 있는 미도달 milestone에만 새 계약을 적용한다. 구체적 migration version·downgrade 동작과 reward table fixture가 승인되어야 Ready가 된다.

## Verification

- 제품 승인, 보상 단일 지급 주체, migration 원자성, offline·분할 결정론과 balance 회귀를 Review한다.

## Test evidence

- 예정: 최초/반복 승리, 환생 후 재처치, reload/offline/분할 실행, A/B rollback, legacy prestige 0/1과 `highestStage` 9/10/299/300 migration 뒤 재선택, safe-integer 경계와 전체 `npm run verify`
