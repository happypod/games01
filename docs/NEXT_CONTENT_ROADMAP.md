# 다음 콘텐츠·시각 로드맵

## 완료 기준선

IRPG-503·504·204·304·403·104·505·305는 Done이다. 현재 기준선은 CI, 저장 이전·충돌 방지, 결정론적 RNG, 첫 환생 수치 밸런스, 접근성, 전체 브라우저 흐름과 24시간 soak를 갖는다.

외부 사용자 10회 실시간 검증은 IRPG-205, 첫 환생 후 최고점 재도달 50~70% 튜닝은 IRPG-206으로 분리되어 있다. 자동 세션을 사람의 재미·이해 증거로 간주하지 않는다.

## 구현 순서

### 콘텐츠·시각 레인

| 순서 | 티켓 | 상태 | 결과 |
|---:|---|---|---|
| 1A | IRPG-406 | Done | asset ID·규격·권리·fallback·초기 600 KiB·lazy-load 계약 |
| 1B | IRPG-106 | Done | 승패·치명타·스킬·처치 UI가 소비할 결정론적 event snapshot |
| 2A | IRPG-407 | Done | 플레이 화면 영웅 아렌 일러스트와 실패 fallback |
| 2B | IRPG-507 | Done | 정상 저장과 격리된 브라우저 UI fixture 조작 패널 |
| 2C | IRPG-413 | Done | 일반 적 5종·보스 3종 일러스트와 실패 fallback |
| 3 | IRPG-506 | Done | 기본 전투 screenshot harness와 CI artifact 계약 |
| 4A | IRPG-408 | Done | 3지역 맵과 roving keyboard 스테이지 탐색 |
| 4B | IRPG-409 | Done | 무기·갑옷·부적과 스킬의 일러스트 카드 |
| 4C | IRPG-411 | Done | 비영속·제한된 전투 이벤트 로그 UI |
| 5 | IRPG-207 | Done | `boss-milestone-v1` 골드 보상의 저장·중복 방지 계약 |
| 6 | IRPG-410 | Draft | nonmodal 승패 알림과 사용자 요청형 일러스트 상세 화면 |
| 7 | IRPG-107 | Draft | 독립 RNG·versioned pending을 쓰는 원정 선택 이벤트 |
| 8 | IRPG-412 | Draft | pending 원정 선택 이벤트 일러스트 카드 UI |
| 9 | IRPG-508 | Draft | 별도 7일 deterministic stress 회귀 |

`1A`와 `1B`, `2A`~`2C`, `4A`~`4C`는 선행 조건이 충족되면 병렬로 진행할 수 있다. 다만 한 변경 묶음에서는 Ready 티켓 하나씩 Review → Verify → Test를 통과시킨다. IRPG-408의 3지역 맵, IRPG-409의 장비·스킬 카드, IRPG-411의 전투 로그가 독립 review, Ubuntu canonical baseline 32개, 최종 push·PR 품질 게이트까지 완료되었다.

IRPG-506은 IRPG-407·413·507 뒤에 기본 전투 harness를 먼저 완성한다. 이후 IRPG-408·409·410·411·412가 자기 화면의 360×800·1440×900·reduced-motion baseline을 해당 티켓 변경에서 추가하므로 “모든 화면 완료를 기다리는 테스트 티켓”이 되지 않는다.

### 밸런스·사용자 검증 레인

| 순서 | 티켓 | 상태 | 결과 |
|---:|---|---|---|
| V1 | IRPG-206 | Done | 정수 효과 4.2%로 비동료 63.3%·동료 63.5%, 20/20 재도달 ratio 50~70% 달성 |
| V2 | IRPG-205 | Draft | 외부 사용자 10회에서 진행 차단 0건·첫 환생 30~45분 검증 |

IRPG-206 결정론적 재도달 기준선은 통과했다. IRPG-205는 실제 참여자 모집·동의·관찰이 필요한 외부 검증이며 자동 세션으로 대체하거나 완료로 추정하지 않는다. IRPG-207은 `boss-milestone-v1` 골드 공식·30-bit 원장·무소급 schema4 migration과 전체 원격 게이트를 완료했다. IRPG-107의 보상 종류·수치·version·소급 정책은 별도 제품 승인 전 추론하지 않는다.

각 Draft는 Ready 전 추정 작업이 2~3일을 넘는지 확인한다. IRPG-408·409·410에서 일러스트 제작과 UI 통합이 이 한도를 넘으면 `asset production`과 `integration`을 별도 티켓으로 나누고, 분리된 각 티켓에 수용 기준과 Review → Verify → Test 증거를 둔다.

## 설계 경계

- 자산은 `assetId`로 콘텐츠에 연결하고 파일 경로나 맵 좌표를 `GameState`에 저장하지 않는다.
- 현재 “아이템”은 무기·갑옷·부적의 고정 강화 트랙이다. 랜덤 드롭·인벤토리는 제품 비범위다.
- 전투 엔진만 보상을 지급한다. 승리·패배 UI는 확정된 이벤트와 이미 지급된 수치만 표시한다.
- 보스 최초 승리 보상은 IRPG-207에서 승인한 `15 × (stage / 10)` 골드만 사용하고 claimed bit와 한 transaction으로 지급한다.
- 승패 결과와 최근 전투 로그는 비영속 표시 상태다. reload 뒤 재생하지 않고 오프라인은 기존 집계 보고를 사용한다.
- 원정 선택 이벤트는 라이브·시즌 이벤트가 아닌 로컬 결정론 콘텐츠다. 전투 RNG를 소비하지 않는 substream, versioned pending effect, 현재 원정 30-bit milestone mask와 별도 save migration이 선행된다.
- 이미지 실패가 전투·저장·스테이지 진행을 막지 않으며 적·스킬·장비 이름의 텍스트 fallback을 항상 유지한다.
- 360×800, 1440×900, 키보드, 스크린리더, 200% 확대와 reduced motion을 각 시각 티켓의 수용 기준에 포함한다.
