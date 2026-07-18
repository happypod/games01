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
| IRPG-201 | 경험치·레벨·장비 성장 | P0 | Done | 102 | GD-BAL, ENG-STATE | 비용 차감과 강화가 원자적이고 레벨업 연속 처리가 된다. |
| IRPG-202 | 스킬 해금·강화 | P0 | Done | 201 | GD-SKILL | 잠금·포인트 비용·최대 랭크가 강제된다. |
| IRPG-203 | 환생·영구 성장 | P0 | Done | 201 | GD-BAL | 초기화와 유지 필드가 정확하고 보상이 한 번 지급된다. |
| IRPG-204 | 첫 환생 밸런스 튜닝 | P1 | In Progress | 203, 502 | GD-BAL, PLAYTEST | 10회 플레이의 중앙값이 30~45분이다. |
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
| IRPG-501 | 엔진·저장·UI 자동 테스트 | P0 | Done | 302,402 | QA-DOMAIN | 전투·명령·저장·오프라인·첫 화면 회귀가 통과한다. |
| IRPG-502 | 45분 밸런스 스모크 | P0 | Done | 203 | GD-BAL, QA-DOMAIN | 자동 재투자 전략이 45분 내 30스테이지에 도달한다. |
| IRPG-503 | CI 릴리스 게이트 | P0 | Done | 003,501 | REL-CI | push와 PR에서 설치·검증·빌드가 통과하고 원격 증거가 남는다. |
| IRPG-504 | Playwright 전체 흐름 | P1 | Done | 402,503 | QA-E2E | 신규→강화→재접속→오프라인 결과를 실제 브라우저로 완료한다. |
| IRPG-505 | 배속 디버그·24시간 soak | P1 | Ready | 104,204 | QA-DOMAIN, PLAYTEST | 1x/10x/100x와 상태 snapshot으로 장시간 이상을 탐지한다. |
| IRPG-601 | 계정·클라우드 저장 ADR | P2 | Blocked | 온라인 요구 확정 | ENG-SAVE, PROD-LOOP | 서버 권위와 충돌 정책이 제품 요구와 함께 승인된다. |

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
