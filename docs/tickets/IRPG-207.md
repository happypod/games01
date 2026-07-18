# IRPG-207 — 보스 최초 승리 보상 계약

## Outcome

승인된 보스 milestone 보상이 foreground·offline·reload·분할 실행에서도 최초 승리 한 번에만 원자적으로 지급된다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Verify
- Skill tags: GD-BAL, ENG-STATE, ENG-SAVE
- Owner / Reviewer: Codex / independent product, balance, engine, and save reviewers

## Scope

- stage 10·20·30부터 300까지 승인된 `boss-milestone-v1` 골드 reward table
- bounded claimed milestone mask와 보상 지급의 단일 engine transaction
- 현재 로컬 A/B 저장 계보에서 유지되고 환생이 명시적으로 복사하는 `claimedBossMilestoneMask`
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
- 2026-07-19 승인된 milestone 보상 종류·공식·version·무소급 정책

## Impacts

- Save schema: `3 → 4` migration; top-level 30-bit `claimedBossMilestoneMask` 추가
- Content config: `boss-milestone-v1`, stage `10 × n` 최초 승리 시 `15 × n` 골드
- Accessibility: none in engine ticket; IRPG-410에서 표시 검토

## Approved product contract

- Table ID: `boss-milestone-v1`
- Reward kind: 기존 재화 `gold`만 사용하며 신규 재화·skill point·cosmetic을 추가하지 않는다.
- Milestone `n = stage / 10`, `n ∈ 1..30`일 때 configured reward는 `15 × n` 골드다. 따라서 stage 10은 15, stage 20은 30, stage 300은 450골드이며 부적·fortune의 반복 처치 골드 배율은 적용하지 않는다.
- 이미 claimed/waived된 milestone에는 table 변경 차액이나 소급 보상을 지급하지 않는다. 미수령 milestone은 실행 중인 현재 승인 table을 사용하며 향후 table 변경은 별도 제품 ticket과 version 승인이 필요하다.
- exactly-once는 현재 선택된 로컬 A/B 저장 계보 안에서 보장한다. 보상 수령 전 portable backup을 의도적으로 복원하면 reward와 ledger가 함께 rollback될 수 있으며, 전역·기기 간 지급 이력은 서버 권위 ledger 없이는 보장하지 않는다.
- 임시 결정론 계측에서 첫 원정 중앙값은 비동료 2,008초·동료 1,886초, 재도달 raw ratio 중앙값은 비동료 63.62%·동료 62.87%이며 20/20 profile이 50~70%를 통과했다.

## Acceptance criteria

- Given 미수령 boss milestone일 때, when 최초 승리 상태 전이가 확정되면, then 승인된 configured 골드의 실제 applied 양과 claimed bit가 하나의 engine transaction에서 정확히 한 번 적용되고 event에 table ID·kind·milestone stage·`configuredGold`·`appliedGold` snapshot이 들어간다.
- Given 이미 수령한 milestone일 때, when 재선택·재승리·reload·offline·단일/분할 실행을 수행하면, then 최초 승리 보상이 다시 지급되지 않는다.
- Given 보상 수령 뒤 환생할 때, when `performPrestige`와 저장 왕복 뒤 같은 boss를 다시 처치하면, then `claimedBossMilestoneMask`가 유지되어 보상이 재지급되지 않는다.
- Given 저장 도중 실패·A/B fallback·portable 왕복일 때, when 복구하면, then 보상과 claimed bit가 서로 어긋난 반쪽 상태를 선택하지 않는다.
- Given legacy 저장일 때, when migration하면, then 기존 최고 stage에 대한 소급 보상을 임의 지급하지 않고 승인된 migration 정책과 downgrade fence를 적용한다.
- Given `highestStage=300`인 legacy 저장일 때, when migration 뒤 stage 300을 재선택·재승리하거나 offline·A/B fallback을 수행하면, then 판별 불가능한 stage 300 보스 보상도 보수적으로 waived되어 지급되지 않는다.
- Given `stats.prestiges > 0`인 legacy 저장일 때, when 현재 `highestStage`가 낮아도 migration하면, then 과거 lifetime 최고점을 복원할 증거가 없으므로 30개 boss milestone 전체를 보수적으로 waived해 복제를 막는다.
- Given 보상이 최대 안전 정수 경계에 닿을 때, when 지급하면, then 재화는 안전 정수로 포화되고 claimed bit는 유지되어 overflow 재시도로 복제되지 않는다.
- Given 승인된 reward table일 때, when IRPG-204·206 회귀를 실행하면, then 첫 환생 30~45분과 재도달 50~70% 기준이 모두 유지된다.
- Given 일반 적·이미 claimed boss·보스 패배일 때, when 전투 event를 생성하면, then milestone reward snapshot은 없고 table lookup이나 ledger mutation이 보상 지급 주체 밖에서 일어나지 않는다.

## Design

보스 처치 상태 전이가 `boss-milestone-v1` table을 조회해 실제 적용 골드, claimed bit와 event snapshot을 함께 갱신하는 유일한 지급 주체다. UI·event consumer·reload는 보상을 계산하거나 지급하지 않는다. 기존 반복 처치 골드·XP를 먼저 기존 계약대로 적용한 뒤 milestone configured 골드의 실제 증가분만 `appliedGold`로 기록하며, 그 milestone 증가분만 `player.gold`·`stats.goldEarned`·`report.goldEarned`에 더한다. 상한에서 `appliedGold=0`이어도 bit를 claim해 재시도를 막는다. `BossVictoryCombatEvent.gold`는 기존 반복 처치 골드만 유지하고 optional `milestoneReward`는 `{ tableId, kind: 'gold', milestoneStage, configuredGold, appliedGold }`를 별도로 snapshot하며 event의 전체 state snapshot은 두 골드 적용 뒤 상태를 가리킨다.

`claimedBossMilestoneMask`는 stage 10~300의 30개 bit로 제한한 lifetime 영속 필드다. `performPrestige`는 다른 영구 상태와 함께 이 mask를 그대로 복사하며 절대 초기화하지 않는다. migration은 `stats.prestiges === 0`이면 기존 `highestStage` 이하(`milestoneStage <= highestStage`)의 bit를 보상 없이 `waived/claimed`로 초기화한다. 현재 상태만으로 승리 여부를 구분할 수 없는 `highestStage=300`도 복제 방지를 우선해 stage 300 bit를 waived한다.

legacy `stats.prestiges > 0`은 과거 원정의 lifetime 최고 stage가 사라져 어떤 milestone이 이미 완료됐는지 복원할 수 없다. 이 경우 30개 bit 전체를 보수적으로 waived하고 신규 최초 보상을 소급 지급하지 않는다. 첫 migration 뒤 증거가 있는 미도달 milestone에만 새 계약을 적용하며 아래 schema 4 정책과 reward table fixture를 canonical 계약으로 사용한다.

## Save and migration contract

- `SAVE_VERSION`은 4이고 `claimedBossMilestoneMask`는 top-level `0..2^30-1` safe integer다. bit index `0..29`는 stage `10..300`에 순서대로 대응하며 signed bitwise 연산 대신 `2 ** index` 산술을 사용한다.
- schema 1·2·3에서 `stats.prestiges === 0`이면 `min(30, floor(min(MAX_STAGE, highestStage) / 10))`개의 하위 bit를 보상 없이 waived한다. 경계는 stage 9=`0`, 10=`1`, 299=`2^29-1`, 300과 legacy `Number.MAX_SAFE_INTEGER`=`2^30-1`이다.
- schema 1·2·3에서 `stats.prestiges > 0`이면 현재 최고점과 무관하게 `2^30-1`로 migration한다.
- schema 4에서 누락·음수·소수·`2^30-1` 초과 mask는 0으로 보정하지 않고 decode를 거부해 A/B 이전 유효 slot으로 fallback한다. schema 4는 schema 3 client에 미래 inner state이므로 기존 `formatVersion=3` envelope 안에서도 구버전 writer의 downgrade overwrite를 차단한다.
- schema 3 migration은 RNG·동료 ID/rank·동료 cooldown을 그대로 보존하고 mask는 legacy 입력의 동명 필드를 신뢰하지 않고 `highestStage`·`prestiges`에서만 파생한다.
- envelope `formatVersion=3`, A/B key, portable `exportVersion=1`은 유지하며 공용 decoder가 raw·A/B·portable schema 1·2·3을 같은 schema 4 상태로 변환한다. reader는 원문을 쓰지 않고 writer만 반대 slot에 새 revision checkpoint를 기록한다.
- `performPrestige`는 mask를 그대로 복사하고 신규 게임만 0으로 시작한다.

## Verification

- 고정된 v1 table, 산술 30-bit mask, 반복 골드→milestone 지급 순서, 실제 적용량 포화와 0골드 claim, 환생 보존, schema3 migration·schema4 strict 거부·future fence, A/B·portable 원자성, balance·soak·visual fixture를 독립 Review했고 최종 P0·P1·P2 결함 0건이다.

## Test evidence

- 최초/반복 stage 10·300, 영웅·동료 마무리, 환생 뒤 재처치, 부분/0골드 포화 claim, 단일·분할 event 결정론, offline writer checkpoint·reload, A/B 실제 fallback replay, portable import 재처치, schema1·2·3 migration과 schema4 mask 경계를 회귀 테스트로 고정했다.
- 첫 원정은 비동료 2,008초·동료 1,886초 중앙값이고 보상 2건·45골드·mask `3`, 환생 재도달은 추가 보상 0건이며 비동료 63.6177%·동료 62.8711%, 20/20 profile이 50~70%를 통과한다.
- 로컬 `npm run verify`: Vitest 28파일·222/222, 자산 validator 27/27, 일반 Playwright 29/29, production 자산 3/3, build 통과; canonical screenshot 비교는 계약대로 로컬 skip했다.
- GitHub quality·Ubuntu canonical visual run과 artifact 증거를 확보한 뒤 Done으로 이동한다.
