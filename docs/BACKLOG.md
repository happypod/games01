# 티켓 백로그

## 1. 상태 흐름

`Draft → Ready → In Progress → Review → Verify → Test → Done`

- **Review**: 코드와 설계의 정적 검토
- **Verify**: 수식·상태 불변식·수용 기준 충족 확인
- **Test**: 실제 실행을 통한 단위·통합·브라우저·플레이 테스트
- P0 티켓은 가능하면 구현자와 검증자를 분리한다.

우선순위는 `P0 내부 MVP 필수`, `P1 공개 알파 전`, `P2 후속 확장`이다.

## 2. 현재 백로그

| ID | 결과 | 우선 | 상태 | 의존 | Skill tags | 핵심 수용 기준 |
|---|---|---:|---|---|---|---|
| IRPG-001 | 핵심 루프·범위 계약 | P0 | Done | - | PROD-LOOP | 제품 흐름, 비범위, 성공 지표가 문서화된다. |
| IRPG-002 | 상태·아키텍처 계약 | P0 | Done | 001 | ENG-STATE | 영속·파생 상태와 의존 방향, 불변식이 정의된다. |
| IRPG-003 | 엄격한 웹 도구체인 | P0 | Done | - | REL-CI | Node 요구 버전과 lint/typecheck/test/build 명령이 재현된다. |
| IRPG-101 | 결정론적 전투 시계 | P0 | Done | 002 | ENG-SIM | 20초 1회와 1초 20회 결과가 같다. |
| IRPG-102 | 적·스테이지·보스·보상 | P0 | Done | 101 | ENG-SIM, ENG-DATA | 처치 보상과 스테이지 증가는 한 번만 발생한다. |
| IRPG-103 | 패배·파밍·스테이지 선택 | P0 | Done | 102 | ENG-STATE | 패배 시 최고 기록 유지, 열린 스테이지만 선택된다. |
| IRPG-104 | 저장 가능한 시드 RNG·치명타 | P1 | Done | 101 | ENG-SIM, ENG-SAVE, QA-DOMAIN | 같은 시드는 같은 이벤트·최종 상태를 만든다. |
| IRPG-105 | 범용 스킬 효과 런타임 | P1 | Draft | 104 | GD-SKILL, ENG-SIM | 회복·버프·보호막의 우선순위와 중첩 정책이 재현된다. |
| IRPG-106 | 결정론적 전투 이벤트 스트림 | P1 | Done | 103,104,505 | ENG-STATE, ENG-SIM, QA-DOMAIN | 치명타·스킬·협공·처치·보스 승리·패배 이벤트 순서가 재현된다. |
| IRPG-107 | 결정론적 원정 선택 이벤트 | P2 | Done | 106,206,303 | PROD-LOOP, ENG-STATE, ENG-SAVE | 로컬 선택 이벤트가 저장·재접속 뒤 한 번만 적용된다. |
| IRPG-108 | 첫 동료 협공 전투 | P1 | Done | 104,204,303,403,505 | ENG-SIM, ENG-STATE, ENG-SAVE, FE-GAME, GD-BAL, QA-E2E | 첫 보스 뒤 영입한 동료가 온라인·오프라인에서 같은 협공을 수행하고 저장된다. |
| IRPG-201 | 경험치·레벨·장비 성장 | P0 | Done | 102 | GD-BAL, ENG-STATE | 비용 차감과 강화가 원자적이고 레벨업 연속 처리가 된다. |
| IRPG-202 | 스킬 해금·강화 | P0 | Done | 201 | GD-SKILL | 잠금·포인트 비용·최대 랭크가 강제된다. |
| IRPG-203 | 환생·영구 성장 | P0 | Done | 201 | GD-BAL | 초기화와 유지 필드가 정확하고 보상이 한 번 지급된다. |
| IRPG-204 | 첫 환생 밸런스 튜닝 | P1 | Done | 203,502,104 | GD-BAL, PLAYTEST, QA-DOMAIN | 10회 플레이의 중앙값이 30~45분이다. |
| IRPG-205 | 외부 사용자 첫 환생 플레이테스트 | P1 | Draft | 204,403,504 | PLAYTEST, UX-FEEDBACK | 외부 사용자 10회에서 진행 차단 0건과 30~45분 목표를 검증한다. |
| IRPG-206 | 환생 후 최고점 재도달 튜닝 | P1 | Done | 104,108,203,204,303,505 | GD-BAL, PLAYTEST, QA-DOMAIN | 재도달 시간 중앙값이 첫 원정의 50~70%다. |
| IRPG-207 | 보스 최초 승리 보상 계약 | P1 | Done | 106,206,303 | GD-BAL, ENG-STATE, ENG-SAVE | 승인된 보스 milestone 보상을 저장·reload 뒤에도 정확히 한 번 지급한다. |
| IRPG-301 | v1 로컬 저장·decoder | P0 | Done | 002 | ENG-SAVE | 정상 왕복과 손상 저장 fallback이 동작한다. |
| IRPG-302 | 자동 저장·8시간 오프라인 | P0 | Done | 101,301 | ENG-SAVE | 0초·역행·8시간 상한·중복 재개가 안전하다. |
| IRPG-303 | A/B 슬롯·revision·migration | P1 | Done | 301 | ENG-SAVE | 두 슬롯 중 최신 유효본을 읽고 v1 fixture를 변환한다. |
| IRPG-304 | 내보내기·가져오기 | P1 | Done | 303,305 | ENG-SAVE, UX-FEEDBACK | 검증·미리보기·확인 전에는 현재 A/B 저장을 바꾸지 않는다. |
| IRPG-305 | 다중 탭 충돌 방지 | P2 | Done | 303 | ENG-SAVE, FE-GAME, QA-E2E | writer lock과 revision guard로 두 번째 탭을 읽기 전용 처리한다. |
| IRPG-401 | 전투·영웅·성장 UI | P0 | Done | 103,202 | FE-GAME, UX-FEEDBACK | 상태와 HUD가 일치하고 구매 불가 버튼이 비활성화된다. |
| IRPG-402 | 오프라인·복구·저장 피드백 | P0 | Done | 302,401 | FE-GAME | 오프라인 합계와 저장 오류·복구 상태가 표시된다. |
| IRPG-403 | 접근성·모바일 감사 | P1 | Done | 401,304 | UX-FEEDBACK, QA-E2E | 360px·키보드·의미 구조·모션 감소 핵심 흐름이 통과한다. |
| IRPG-404 | 초기 안내·전투 피드백 강화 | P1 | Draft | 401 | UX-FEEDBACK | 3초 안에 자동 전투와 첫 강화 목표를 이해한다. |
| IRPG-405 | Windows 원클릭 실행기 | P1 | Done | 003 | REL-CI, UX-FEEDBACK | 더블클릭 한 번으로 의존성을 준비하고 게임과 브라우저를 실행한다. |
| IRPG-406 | 시각 자산 계약·manifest | P1 | Done | 401,403,505 | ART-DIR, ART-2D, ENG-DATA | 모든 자산 ID·규격·권리·fallback과 누락 검사가 고정된다. |
| IRPG-407 | 플레이 화면 영웅 캐릭터 표시 | P1 | Done | 403,406 | ART-2D, FE-GAME, UX-FEEDBACK | 아렌 일러스트가 고정 프레임과 실패 fallback으로 표시된다. |
| IRPG-408 | 3지역 스테이지 맵 | P2 | Done | 103,403,406,506 | ART-2D, FE-GAME, ENG-DATA, UX-FEEDBACK | 지역 3개와 현재·완료·잠김 스테이지가 접근 가능하게 표시된다. |
| IRPG-409 | 장비·스킬 일러스트 카드 | P2 | Done | 201,202,403,406,506 | ART-2D, FE-GAME, UX-FEEDBACK | 고정 장비·스킬의 효과·비용·잠금·최대 상태가 카드에 표시된다. |
| IRPG-410 | 보스 승리 보상·패배 결과 화면 | P1 | Done | 106,207,403,406,413,506 | ART-2D, FE-GAME, UX-FEEDBACK | 엔진 보상을 재지급하지 않고 승패 결과를 이벤트당 한 번 표시한다. |
| IRPG-411 | 전투 이벤트 로그 UI | P2 | Done | 106,108,403,506 | FE-GAME, ENG-STATE, UX-FEEDBACK | 제한된 최근 전투 이벤트를 자동 전투를 막지 않고 표시한다. |
| IRPG-412 | 원정 선택 이벤트 카드 UI | P2 | Done | 107,403,406,409,506 | ART-2D, FE-GAME, ENG-STATE, UX-FEEDBACK | pending 선택 카드를 접근 가능하게 표시하고 명령을 한 번 호출한다. |
| IRPG-413 | 일반 적·보스 일러스트 세트 | P2 | Done | 102,403,406 | ART-2D, FE-GAME, UX-FEEDBACK | 적 5종·보스 3종이 고유 일러스트와 텍스트 fallback으로 표시된다. |
| IRPG-414 | 데스크톱 원 뷰 대시보드 | P1 | Done | 401,403,407,408,409,410,411,412,506 | FE-GAME, UX-FEEDBACK, QA-E2E | 1024px 이상에서 문서 스크롤 없이 전투·원정·성장을 한 화면에서 조작하고 360px 세로 흐름을 보존한다. |
| IRPG-415 | 선택형 통합 전술 전장 | P1 | Done | 106,107,108,403,408,409,410,411,412,413,414,506 | ART-2D, FE-GAME, UX-FEEDBACK, QA-E2E | 기존 유형 1 대시보드를 보존하고 같은 진행 상태를 사용하는 유형 2 통합 전술 전장을 선택해 플레이한다. |
| IRPG-416 | 동적 전투 연출·비노출 전투 손상 | P1 | Done | 106,108,403,410,413,415,506 | ART-2D, FE-GAME, UX-FEEDBACK, QA-E2E | 전투 이벤트에 맞춘 동작·플로팅 수치·필살기 연출과 안전한 3단계 갑옷 손상이 저장·전투 결과를 바꾸지 않고 표시된다. |
| IRPG-417 | 전술 전장 연출 가시성·원정 오버레이 접기 | P1 | Done | 403,412,415,416,506 | FE-GAME, UX-FEEDBACK, QA-E2E | 저장된 원정 이벤트가 있어도 전장을 먼저 표시하고 필요할 때만 선택 오버레이를 열며 갑옷 손상 단계를 명확히 설명한다. |
| IRPG-418 | 전투·캠프 전환과 오프라인 원정 | P1 | Done | 302,303,304,305,403,414,415,417,504,506 | ENG-STATE, ENG-SAVE, FE-GAME, QA-E2E | 캠프 전경 전투는 멈추고 재접속 오프라인 원정은 마지막 전투 상태부터 정확히 한 번 정산한다. |
| IRPG-419 | 캠프 시설·영구 훈련·오프라인 상한 | P1 | Done | 203,204,206,303,304,403,418,505,506 | GD-BAL, ENG-STATE, FE-GAME | 시설·훈련 구매는 원자적이며 텐트 단계가 오프라인 상한을 8~12시간으로 확장한다. |
| IRPG-420 | 고정 재료·결정론 제작·소모 버프 | P1 | Done | 104,106,303,304,403,419,505,506 | ENG-DATA, ENG-STATE, GD-BAL, FE-GAME | 모든 처치 재+1·늑대 가죽+1·보스 핵+1, 단일 제작 job, 1,800-round 골드와 다음 보스 집중 효과가 RNG·보상을 중복하지 않는다. |
| IRPG-421 | 이벤트 상인·성인 구조 계약·신뢰 | P2 | Done | 107,108,207,303,304,403,412,417,420,506 | ENG-DATA, ENG-STATE, NARRATIVE, FE-GAME | 30분 고정 3-cycle 상인과 성인 구조 지원→별도 자발적 계약→신뢰가 exact-once 원장과 단일 전투 동료 계약을 지킨다. |
| IRPG-422 | 전술 전장 단일화·전투 슬롯바·유틸리티 도크 | P1 | Done | 304,403,409,410,411,414,415,417,418,420,506 | FE-GAME, UX-FEEDBACK, A11Y, QA-E2E, REL-CI | 유형 2 전술 전장을 단일 전투 화면으로 승격하고 실제 자산 슬롯바와 아이콘 유틸리티 도크에서 주요 기능을 빠르게 실행한다. |
| IRPG-423 | 캠프 치유 화로·회복 물약 상태 계약 | P1 | Done | 104,108,303,304,305,403,418,419,420,422,505,506 | GD-BAL, ENG-STATE, ENG-SAVE, FE-GAME, QA-DOMAIN | 캠프에서 재료로 완전 회복하고 확정 제작한 회복 물약을 장착해 전투 중 exact-once로 사용한다. |
| IRPG-424 | 전술 정보 레일·8슬롯 명령 재배치 | P1 | Test | 423,403,408,409,413,422,506 | FE-GAME, UX-FEEDBACK, A11Y, QA-E2E, REL-CI | 하단 8슬롯에 성장·동료·회복 명령을 모으고 우측은 적·지도·캐릭터·가방·스킬·도감 정보로 재구성한다. |
| IRPG-425 | CHAPTER I 성인 동의 계약·캠프 특수 시설 | P1 | Done | 403,418,421,424 | PROD-LOOP, ENG-STATE, NARRATIVE, FE-GAME, A11Y | 성인 확인과 별도 세라 동의를 거친 CHAPTER I 유대 시설만 열고 철회에 불이익을 주지 않는다. |
| IRPG-426 | CHAPTER I 의상 원장·자산 manifest·schema8 migration | P1 | Done | 303,304,406,423,425 | ENG-SAVE, ENG-DATA, ART-DIR, QA-DOMAIN | 의상 원장과 샘플 1개를 저장·manifest로 연결하고 CHAPTER II·III 자산을 CI에서 차단한다. |
| IRPG-427 | 결정론적 합동 연성 비용·수집 보상·중복 방지 | P1 | Done | 104,207,420,425,426 | ENG-STATE, ENG-SAVE, GD-BAL, QA-DOMAIN | 고정 비용과 수집 카드를 한 번만 교환하며 RNG·전투 성장을 바꾸지 않는다. |
| IRPG-428 | 특수 시설 연출·접근성·Ubuntu 시각 회귀 | P1 | Test | 403,506,425,426,427 | FE-GAME, UX-FEEDBACK, A11Y, QA-E2E, REL-CI, ART-2D | 실루엣·불꽃·보상 카드 연출을 모바일·키보드·모션 감소와 Ubuntu visual gate로 검증한다. |
| IRPG-501 | 엔진·저장·UI 자동 테스트 | P0 | Done | 302,402 | QA-DOMAIN | 전투·명령·저장·오프라인·첫 화면 회귀가 통과한다. |
| IRPG-502 | 45분 밸런스 스모크 | P0 | Done | 203 | GD-BAL, QA-DOMAIN | 자동 재투자 전략이 45분 내 30스테이지에 도달한다. |
| IRPG-503 | CI 릴리스 게이트 | P0 | Done | 003,501 | REL-CI | push와 PR에서 설치·검증·빌드가 통과하고 원격 증거가 남는다. |
| IRPG-504 | Playwright 전체 흐름 | P1 | Done | 402,503 | QA-E2E | 신규→강화→재접속→오프라인 결과를 실제 브라우저로 완료한다. |
| IRPG-505 | 배속 디버그·24시간 soak | P1 | Done | 104,204 | QA-DOMAIN, PLAYTEST | 1x/10x/100x와 상태 snapshot으로 장시간 이상을 탐지한다. |
| IRPG-506 | 시각 브라우저 회귀 게이트 | P1 | Done | 403,504,406,407,413,507 | QA-E2E, REL-CI, ART-DIR | 기본 전투 시각 상태의 screenshot harness를 만들고 후속 UI가 baseline을 확장한다. |
| IRPG-507 | 브라우저 개발자 디버그 패널 | P2 | Done | 403,505 | FE-GAME, QA-DOMAIN | 개발 모드에서 배속·stage·자원·오프라인 시간을 저장과 격리해 조절한다. |
| IRPG-508 | 7일 장기 stress 회귀 | P2 | Draft | 505 | ENG-SIM, QA-DOMAIN | 7일 가속에서 숫자·정체·snapshot 크기 회귀를 고정 fixture로 탐지한다. |
| IRPG-601 | 계정·클라우드 저장 ADR | P2 | Blocked | 온라인 요구 확정 | ENG-SAVE, PROD-LOOP | 서버 권위와 충돌 정책이 제품 요구와 함께 승인된다. |
| IRPG-700 | 인벤토리·장비·스킬 제품 범위 및 상태 계약 | P1 | Done | 424,428 | PROD-LOOP, ENG-STATE | 삼원 인벤토리·부위 장착·스킬 슬롯 제품 범위와 밸런스·저장 계약이 승인된다. |
| IRPG-701 | Schema 9·ITEM_REGISTRY·독립 마이그레이션 | P1 | Done | 700 | ENG-STATE, ENG-SAVE | Schema 9 타입, 고정 아이템 레지스트리, V1~V8 독립 decoder가 검증된다. |
| IRPG-702 | 장비 드롭·이관·이동·장착·스탯 엔진 | P1 | Done | 701 | ENG-SIM, ENG-STATE | 전리품 자동 이관, 1개 단위 장착·반환, 파생 스탯 및 체력 클램핑이 보장된다. |
| IRPG-704 | 능동 스킬 슬롯 실행 및 연동 계약 | P1 | Done | 702 | GD-SKILL, ENG-SIM | 3개 슬롯 장착 스킬이 전투 시계 및 자동 전투와 완벽히 연동된다. |
| IRPG-703 | 캐릭터 장비창·인벤토리·스킬 슬롯 UI | P1 | Done | 701,702,704 | FE-GAME, UX-FEEDBACK | 부위별 장비창, 가방 Grid, 스킬 슬롯 UI가 접근성과 visual gate를 충족한다. |
| IRPG-800 | 포획·생체카드·2.5D 캠프 확장 제품 범위 | P1 | Draft | 425,426,427,428,700,701,702,703,704 | PROD-LOOP, NARRATIVE, ENG-STATE | 사람형 캡티브는 동의 기반, 야수형은 포획 기반이라는 구분과 IRPG-801~804 분해가 승인된다. |
| IRPG-801 | 결정론적 포획 엔진·`livingCards` 실제 상태화 | P1 | Test | 800,101,104,106 | ENG-STATE, ENG-SIM, GD-BAL | capturable 몬스터 처치 시 captureLoyalty가 결정론적으로 누적되고 비-capturable 몬스터는 영향받지 않는다. |
| IRPG-802 | LivingCardConsole 실데이터 연동 | P1 | Test | 801 | FE-GAME, UX-FEEDBACK, QA-DOMAIN | 포획 콘솔이 클라이언트 가짜 수치 대신 실제 livingCards와 전투 이벤트만 표시한다. |
| IRPG-803 | 2.5D 캠프 오브젝트 캔버스 | P1 | Test | 419,424,425,403,506 | FE-GAME, UX-FEEDBACK, A11Y, ART-2D, QA-E2E | 좌표 기반 시설·세라 액터가 기존 카드 UI와 병행 제공되고 키보드·모바일 접근성을 만족한다. |
| IRPG-804 | 동료화·캠프 크래프팅·합동 연성(교배) 확장 | P2 | Draft | 801,802,803,427 | PROD-LOOP, GD-BAL, ENG-STATE, NARRATIVE | 미해결 질문 답변 후 Ready 전환, 포획 개체의 동료화·크래프팅·교배 경로가 결정론적으로 정의된다. |
| IRPG-805 | 전장 Floating HUD 폴리시(머리 위 체력바·원형 스킬 닷) | P2 | Draft | 416,422,424,506 | FE-GAME, UX-FEEDBACK, ART-2D, QA-E2E | 머리 위 실체력 태그와 실쿨다운 원형 스킬 버튼이 기존 판정 변경 없이 표시되고 DirectHotbar 고아 코드가 제거된다. |
| IRPG-806 | 캐릭터 탭 동시 표시 레이아웃(IRPG-703 재구성) | P2 | Draft | 703,701,702,704,403 | FE-GAME, UX-FEEDBACK, A11Y | 캐릭터 탭이 2단 동시 표시로 재배치되고 기존 장착·해제 로직과 테스트가 그대로 통과한다. |

`Blocked`는 기술 문제가 아니라 제품 요구가 아직 없는 의도적 보류다. 신규 기능은 선행 티켓과 G4 게이트를 우회하지 않는다.

## 3. Definition of Ready

- 결과가 사용자 또는 시스템 관점 한 문장으로 정의되어 있다.
- 범위와 비범위가 분리되어 있다.
- Given/When/Then 형태의 측정 가능한 수용 기준이 있다.
- 선행 티켓, 저장 영향, 콘텐츠 설정 영향이 표시되어 있다.
- 필요한 fixture, 가짜 시계, 시드 조건이 적혀 있다.
- UI는 정상·잠김·빈 상태·오류·최대 상태를 정의한다.
- 작업 크기가 2~3일을 넘지 않으며 넘으면 분할한다.
- 구현·검토 담당과 Skill tags가 지정되어 있다.

## 4. Definition of Done

- 모든 수용 기준이 코드, 테스트, 또는 검증 증거에 연결된다.
- 관련 설계와 밸런스 설정이 함께 갱신된다.
- 리뷰, lint, strict typecheck, 자동 테스트, production build가 통과한다.
- 시간·재화·HP·레벨·스테이지 경계값 회귀가 있다.
- 저장 변경에는 migration과 이전 저장 fixture가 있다.
- UI 변경은 모바일·키보드·모션 감소 설정을 확인한다.
- 데이터 손실, 보상 복제, 진행 차단 등 S0/S1 결함이 없다.
- 티켓의 `Verification`과 `Test evidence`가 채워진 뒤에만 Done으로 이동한다.

## 5. 티켓 작성 형식

새 티켓은 [티켓 템플릿](TICKET_TEMPLATE.md)을 사용한다. 구현 PR 또는 변경 묶음은 한 개 이상의 티켓 ID를 제목이나 설명에 포함한다.
