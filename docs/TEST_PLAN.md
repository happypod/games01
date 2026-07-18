# 검증·테스트 계획

## 1. 품질 전략

검증과 테스트를 구분한다.

- **검증(Verify)**: 구현이 제품·수식·상태 계약과 불변식을 만족하는지 확인
- **테스트(Test)**: 실제 코드와 브라우저를 실행해 실패·회귀·환경 차이를 찾음

도메인 단위 테스트를 중심에 두고, 저장 통합, React 컴포넌트, 실제 브라우저, 플레이테스트 순으로 범위를 넓힌다.

## 2. 자동 테스트 계층

| 계층 | 현재 | 검증 내용 |
|---|---:|---|
| 엔진 단위 | 구현 | 최초 상태, 보상, 결정론, 경과 시간 상한, 구매 원자성, 스킬 잠금, 스테이지, 환생, 숫자 불변식 |
| RNG·치명타 | 구현 | xorshift32 vector, 1 draw/round, 치명타 수식, 동일 seed·분할 실행·환생 연속성 |
| 저장 통합 | 구현 | A/B 교대, revision 선택·동률, 부분 쓰기, 손상 fallback, 미래 포맷 차단, v1 migration, 오프라인 1회 적용, 초기화 |
| 저장 전송 | 구현 | portable checksum·버전·크기, preview no-write, stale CAS, target rollback, export/import 브라우저 왕복 |
| UI 컴포넌트 | 구현 | 첫 화면 landmark와 주요 패널, 구매 불가 상태 |
| 밸런스 회귀 | 구현 | 고정 seed·3개 장비 전략·5~20초 판단 주기 10세션의 첫 환생 중앙값, milestone, 정체, 숫자 불변식, 최종 상태 해시 |
| 브라우저 E2E | 구현 | 신규 시작, UI 강화, 실제 reload, 1분 오프라인 보고, 같은 구간 중복 방지, page/console error |
| 다중 탭 E2E | 구현 | 두 번째 탭 읽기 전용, 열린 reader 동기화, writer 종료 뒤 lock 인계 |
| 접근성 E2E | 구현 | 360px overflow·44px target·skip link·키보드 명령·progressbar·modal focus·200% 확대·모션 감소 |
| 장시간 soak | 구현 | 1x·10x·100x의 8·16·24시간 전체 상태·누적 report, safe integer·HP·stage·RNG·정체·고정 fixture |

IRPG-303 완료 기준선은 Vitest 파일 5개, 테스트 28개다. 전체 coverage는 statements 93.42%, branches 87.95%, functions 97.91%, lines 95.60%다. IRPG-504는 별도의 Playwright 전체 흐름 1개를 추가한다.

## 3. 요구사항 추적

| 요구 | 자동 증거 | 남은 수동·E2E |
|---|---|---|
| 보상 1회 지급 | `engine.test.ts` 처치 보상 | 전투 표시와 숫자 체감 확인 |
| 동일 시간 결정론 | 20초 단일/분할 비교 | 브라우저 백그라운드 복귀 |
| 저장 RNG·치명타 | known vector, 999/1000ms draw 경계, 동일 seed·분할·reload/offline, 환생 sequence | 치명타 시각 피드백은 후속 이벤트 UI 티켓 |
| 구매 원자성 | 성공·골드 부족 | 연속 클릭 탐색 테스트 |
| 스킬 잠금·비용 | 레벨·포인트 경계 | 잠금 사유 시각 확인 |
| 스테이지·패배 | 선택 범위와 장시간 엔진 | 보스 패배 후 피드백 |
| 환생 유지·초기화 | 영구·임시 필드 비교 | 확인 대화상자와 예상 보상 |
| 저장 복구 | A/B fallback·부분 쓰기·미래 포맷·v1 migration | 실제 저장 차단 환경 |
| 저장 백업 | checksum·크기·schema·stale revision·read-back rollback, Playwright 다운로드·취소·복원 | 다른 기기 파일 이동 |
| 오프라인 중복 방지 | 같은 시각 재부팅, Playwright 닫기·재접속·재새로고침 | 탭 숨김과 OS 절전 복귀 |
| 다중 탭 충돌 | stale revision 원문 불변, reader 무쓰기, 동일 revision 충돌 차단, 두 페이지 lock 인계 | 비정상 브라우저 종료 복구 |
| 반응형·접근성 | progressbar·modal focus 컴포넌트 테스트, 360px·키보드·reduced-motion Playwright | 실제 보조공학 조합의 외부 전문 감사 |
| 첫 환생 목표 | 10회 결정론적 가속 세션과 대표 브라우저 상태 | IRPG-205 외부 사용자 10회 실제 플레이 |
| 장시간 결정론 | 1x·10x·100x 24시간 soak와 3×8시간 canonical 비교 | IRPG-507 브라우저 개발 패널·7일 stress |

## 4. 필수 경계값

### 시간

- 0ms, 음수, `NaN`
- 999ms / 1,000ms 라운드 경계
- 5초 오프라인 모달 경계
- 정확히 8시간 / 8시간 초과
- 저장 시각이 미래인 경우

### 경제·전투

- 비용보다 1 부족 / 정확히 일치 / 1 초과
- 적 HP가 피해와 정확히 같은 경우
- 플레이어 HP가 반격과 정확히 같은 경우
- 한 번에 여러 레벨 상승
- 최대 강화·스킬 랭크·최대 스테이지
- 최대 안전 정수의 보상·경험치·처치·패배·스킬 포인트·환생 포화와 저장 가능 상태 유지

### 저장

- 키 없음, 빈 문자열, 잘못된 JSON
- 필드 누락, 음수·무한 숫자, 잘못된 버전
- localStorage 읽기·쓰기 예외
- A/B 슬롯 한쪽 손상, revision 동률·충돌, migration 실패
- 미래 envelope·state schema, 잘못된 RNG algorithm/state/draws, revision overflow, 과대 쿨다운 정규화, 저장소 read/write/remove 예외

## 5. 수동 브라우저 체크리스트

G4에서 아래 조합을 기록한다.

- Chrome·Edge 최신, 모바일 360×800, 데스크톱 1440×900
- 마우스 없이 Tab/Shift+Tab/Enter로 강화·스킬·스테이지 이동
- 200% 확대에서 가로 스크롤과 가려진 버튼 없음
- `prefers-reduced-motion`에서 지속 회전·pulse가 사실상 제거됨
- 탭을 1분 숨긴 뒤 복귀 시 시간 누락·중복 없음
- 저장 차단 시 경고가 보이고 게임은 계속 동작함
- 환생 확인에서 취소하면 어떤 상태도 바뀌지 않음

## 6. 플레이테스트

기록 항목:

- 첫 전투, 첫 강화, 첫 보스, 첫 패배, 30스테이지 도달 시각
- 10분 내 구매 횟수와 선택 이유
- 막힌 구간과 필요한 강화 횟수
- 환생 전후 동일 스테이지 재도달 시간
- 오프라인 복귀 보상의 유용성
- UI에서 이해하지 못한 숫자·용어

IRPG-204의 자동 10세션은 수치 진행과 재현성을 검증하며, 대표 브라우저 세션은 UI와 엔진 상태의 일치를 점검한다. 이 증거는 사람의 이해·기대·재미를 증명하지 않으므로 외부 사용자 10회 실제 플레이는 IRPG-205에서 별도로 수행한다.

## 7. 명령과 릴리스 증거

```bash
npm ci
npx playwright install chromium
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

로컬 전체 게이트는 `npm run verify`다. 브라우저 제외 게이트는 `npm run verify:code`다. CI는 Chromium과 시스템 의존성을 설치한 뒤 동일 전체 게이트를 worker 1개로 실행하며, 실패한 Playwright trace·screenshot·video와 HTML report를 artifact로 보존한다. 티켓을 Done으로 옮길 때 명령, 통과 결과, 필요한 수동 증거를 `Test evidence`에 남긴다.

## 8. 현재 브라우저 증거

- [데스크톱 전체 화면](../artifacts/desktop.png): 주요 패널, 보스 전투, 성장 버튼 렌더링 확인
- [390px 모바일 전체 화면](../artifacts/mobile.png): 단일 열 전환, 버튼·텍스트 가림 없음 확인
- 실제 Chrome에서 본문 존재, Vite 오류 overlay 없음, page error 없음 확인
- `불씨 검` 강화 비용이 18G에서 26G로 변경되고 새로고침 뒤에도 26G로 유지됨을 확인
- [IRPG-504 개발 서버 점검](../artifacts/irpg-504-dev-check.png): 본문·핵심 landmark·상호작용 요소 렌더링, Vite 오류 overlay와 console error 없음
- Playwright Chromium에서 신규→Lv.1 강화→reload 유지→1분 오프라인 보고→확인 후 reload 중복 없음 흐름 자동화
- [IRPG-403 360×800 전체 화면](../artifacts/irpg-403-360.png): 단일 열, 핵심 조작 44px, 텍스트·버튼 잘림 없음 확인
- IRPG-403 접근성 시나리오는 bundled Chromium, 설치된 Chrome, Edge에서 각각 2/2 통과했으며 page/console error가 없었다.

이 스크린샷은 자동 생성된 검증 증거이며 미술 방향의 최종 승인을 뜻하지 않는다.
