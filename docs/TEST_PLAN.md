# 검증·테스트 계획

## 1. 품질 전략

검증과 테스트를 구분한다.

- **검증(Verify)**: 구현이 제품·수식·상태 계약과 불변식을 만족하는지 확인
- **테스트(Test)**: 실제 코드와 브라우저를 실행해 실패·회귀·환경 차이를 찾음

도메인 단위 테스트를 중심에 두고, 저장 통합, React 컴포넌트, 실제 브라우저, 플레이테스트 순으로 범위를 넓힌다.

## 2. 자동 테스트 계층

| 계층 | 현재 | 검증 내용 |
|---|---:|---|
| 엔진 단위 | 구현 | 최초 상태, 보상, 결정론, 경과 시간 상한, 구매 원자성, 스킬·동료 잠금, 동료 영입·훈련·협공, 스테이지, 환생, 숫자 불변식 |
| RNG·치명타 | 구현 | xorshift32 vector, 1 draw/round, 치명타 수식, 동일 seed·분할 실행·환생 연속성 |
| 전투 이벤트 스트림 | 구현 | skill·critical·companionAssist·kill·bossVictory·defeat 고정 순서, 단일·분할 ID, 최근 100개, MAX_SAFE 초과 cursor, 저장 비영속 |
| 저장 통합 | 구현 | A/B 교대, revision 선택·동률, 부분 쓰기, 손상 fallback, 미래 포맷 차단, schema1·2→3 migration, 동료 오프라인 진행 1회 적용, 초기화 |
| 저장 전송 | 구현 | portable checksum·버전·크기, preview no-write, stale CAS, target rollback, export/import 브라우저 왕복 |
| UI 컴포넌트 | 구현 | 첫 화면 landmark, 구매 불가 상태, 비영속 승패 queue·dedupe·pinned snapshot·focus 복원 |
| 밸런스 회귀 | 구현 | 고정 seed·3개 장비 전략·5~20초 판단 주기의 첫 환생 10세션과 비동료·동료 각 10개 paired 재도달 ratio, milestone, 정체, 숫자 불변식, 최종 상태 해시 |
| 브라우저 E2E | 구현 | 신규 시작, UI 강화, 실제 reload, 1분 오프라인 보고, 같은 구간 중복 방지, page/console error |
| 다중 탭 E2E | 구현 | 두 번째 탭 읽기 전용, 열린 reader 동기화, writer 종료 뒤 lock 인계 |
| 접근성 E2E | 구현 | 360px overflow·44px target·skip link·키보드 명령·progressbar·modal focus·200% 확대·모션 감소 |
| 시각 자산 | 구현 | 필수 27 ID·로컬 경로·실제 포맷/픽셀/바이트·권리 metadata, fallback 2단계, production cold-load 600 KiB와 lazy namespace |
| 시각 회귀 | 구현 | Ubuntu 24.04·고정 Chromium/font/time/seed에서 13 named fixture × 4 viewport/motion variant, state/event hash, overflow·motion, screenshot diff artifact |
| 장시간 soak | 구현 | 1x·10x·100x의 8·16·24시간 전체 상태·누적 report, safe integer·HP·stage·RNG·정체·고정 fixture |

IRPG-107 Done 기준선은 Vitest 34파일·274테스트다. schema5 run-pinned marker, markerless schema5 literal-v1 transition, frozen v1 shuffle golden hash, 10~300 milestone, pending 3·overflow 27 상한, 선택 transaction·중복 no-write, MAX_SAFE, schema1~4 migration, 빈 queue·pending-only future A/B·legacy·portable fence, portable rollback, split/offline·24시간 soak를 포함한다. 4개 선택 조합 × 10 seed × 솔로/동료 80 paired session은 80/80 통과했고 첫 환생 cohort 중앙값 1,863.5~2,013.5초, 재도달 ratio 54.3562~69.9886%, aggregate hash `b2a62828`을 기록했다. 회복률 5%·5%·5%의 각 +5%p 인접 후보는 79/80로 실패해 승인 격자 경계를 확인했다. 로컬 `npm run verify`와 commit `da731ea`의 push·PR quality-gate가 성공했고 Ubuntu canonical 40/40 및 3회 반복 120/120도 통과했다.

IRPG-303 완료 기준선은 Vitest 파일 5개, 테스트 28개다. 전체 coverage는 statements 93.42%, branches 87.95%, functions 97.91%, lines 95.60%다. IRPG-504는 별도의 Playwright 전체 흐름 1개를 추가한다.

IRPG-108 기준선은 Vitest 12파일·85테스트와 Playwright 8테스트다. 전체 coverage는 statements 94.12%, branches 89.81%, functions 100%, lines 95.39%이며, active companion 1x·10x·100x soak와 schema2→3 저장 회귀를 포함한다.

IRPG-406 기준선은 Vitest 16파일·95테스트, 자산 validator fixture 21테스트, 기존 Playwright 8테스트와 production 자산 Playwright 2테스트다. 필수 27개 ID, 600 KiB cold-load, 비현재 namespace lazy-load와 이미지 실패 fallback을 포함한다.

IRPG-407 기준선은 같은 Vitest·validator에 영웅 Playwright 4테스트를 더한 일반 Playwright 12테스트와 production 자산 Playwright 2테스트다. 1440px·360px·200% 확대, decorative semantics, corrupt WebP→SVG fallback 뒤 전투·저장 지속을 포함한다.

IRPG-106 기준선은 Vitest 17파일·113테스트, 자산 validator 21테스트, 일반 Playwright 12테스트와 production 자산 2테스트다. IRPG-411 확장에서 전투 이벤트 전용 회귀에 협공 ordinal 25·적용 피해 snapshot·영웅 선처치 미발행·동료 마무리 단일 outcome·RNG 및 보상 불변을 추가했으며, persistence와 hook 테스트가 offline aggregate 유지 및 bootstrap·reset·import queue 폐기를 계속 검증한다.

IRPG-413 기준선은 Vitest 20파일·127테스트, 자산 validator 21테스트, 일반 Playwright 17테스트와 production 자산 3테스트다. 적 5종·보스 3종의 stage `1..5`, `10`, `20`, `30` stable mapping, 고유 768×768 WebP, decorative semantics, 360px·200%·reduced-motion geometry, corrupt decode fallback 뒤 전투·A/B autosave 지속과 비현재 portrait lazy-load를 포함한다.

IRPG-506 기준선은 Vitest 21파일·130테스트, 자산 validator 21테스트, Ubuntu canonical screenshot 16개와 같은 runner 3회 반복 48테스트다. hero·enemy·boss·fallback fixture마다 360×800·1440×900 × default·reduced motion을 비교하고 state hash·font/image decode·overflow·가려진 명령·지속 motion·page/console error를 함께 검증한다.

IRPG-408 기준선은 Vitest 23파일·153테스트, 자산 validator 25테스트, 일반 Playwright 23테스트, production 자산 Playwright 3테스트와 Ubuntu canonical screenshot 20개다. 지역 3개의 경계·현재/완료/최전선/잠김·boss 파생, click/Enter/Space 차단, roving tab·Arrow/Home/End/Page 이동, 360px·200% 확대, corrupt region fallback, 자동 전투 중 focus 불변, disclosure 전 region 요청 0과 활성 지역 단독 lazy-load를 포함한다. `visual.map.stage-frontier`는 stage/highestStage 105에서 4개 반응형·모션 variant를 추가하며 canonical 20/20 비교와 같은 runner 3회 반복 60/60을 통과했다.

IRPG-409 기준선은 Vitest 25파일·161테스트, 자산 validator 27테스트, 일반 Playwright 26테스트, production 자산 Playwright 3테스트와 Ubuntu canonical screenshot 28개다. 장비·스킬 6개 카드의 비용·잠금·최대·fallback과 360px·200%·키보드 순서를 포함한다.

IRPG-411 기준선은 Vitest 26파일·169테스트, 자산 validator 27테스트, 일반 Playwright 29테스트, production 자산 Playwright 3테스트와 Ubuntu canonical screenshot 32개다. 협공 ordinal 25·RNG/보상 불변, 최근 20개·unknown fallback, StrictMode 단일 5초 timer와 reset/unmount cleanup, 360px keyboard/filter/reload/offline, 200%·reduced-motion을 포함한다. 기존 28개 SHA-256 28/28 불변, 새 4개 canonical, 같은 runner 3회 반복 96/96을 확인했다.

IRPG-206 기준선은 비동료·동료 각 10개 첫 원정→환생→stage 30 재도달 paired session이다. raw profile ratio 중앙값은 비동료 63.2757821162%, 동료 63.4627441524%이며 20/20이 50~70% 안이다. 첫 원정 중앙값 1,984.5초·1,865초와 장기 적 HP 1.15 곡선을 유지하고, 20개 최종 상태 exact hash·RNG 연속·입력 불변과 A/B revision 1→2의 600초 checkpoint reader 재개를 고정 oracle로 검증한다. 최종 기준선은 Vitest 27파일·176테스트, 자산 validator 27테스트, 일반 Playwright 29테스트, production 자산 Playwright 3테스트와 Ubuntu canonical screenshot 32개다.

IRPG-410 Done 기준선은 Vitest 32파일·243테스트, 자산 validator 30테스트, 신규 일반 Playwright 6테스트, production 자산 Playwright 4테스트와 named fixture 10개·canonical screenshot 40개다. bossVictory/defeat 전용 BigInt dedupe·queue 3·overflow·generation reset·pinned snapshot·reward non-mutation, focus trap/복원, reload/offline 비재생, 360px·200%·reduced-motion, corrupt result fallback, status 0→detail 1개 lazy-load를 포함하며 Ubuntu 40/40 비교와 같은 runner 3회 반복 120/120을 통과했다.

IRPG-412 Done 기준선은 Vitest 35파일·285테스트, 자산 validator 32테스트, 일반 Playwright 37테스트, production 자산 Playwright 4테스트와 named fixture 12개·canonical screenshot 48개다. 저장된 원정 효과 preview·1,000 이상 비축약, 성공 revision +1·재선택/reader/save-failed no-write, rapid 중복 차단, 성공·거절·외부 snapshot focus, 카드별 요청 0→1→2→3, corrupt event `fallback.card`, 360px·200%·reduced-motion을 포함한다. Ubuntu 48/48·3회 반복 144/144, 신규 event baseline 8개 수동 검토와 체크인된 48개의 push·PR quality gate를 모두 통과했다.

IRPG-414 Test 기준선은 Vitest 36파일·297테스트, 자산 validator 32테스트, 일반 Playwright 40테스트, production 자산 Playwright 4테스트와 named fixture 13개·canonical screenshot 52개다. 1440×900·1024×768 문서 무스크롤 35/40/25 대시보드, 360×800 세로 흐름, 성장 탭 keyboard/ARIA, 현재 10단계 strip, 최근 5개 로그, 내부 pane 스크롤과 lazy namespace를 포함한다. Ubuntu workflow run `29689021639`에서 52/52 생성과 같은 runner 3회 반복 156/156을 통과했고 대표 기준선을 `design-qa.md`에 수동 검토했다.

## 3. 요구사항 추적

| 요구 | 자동 증거 | 남은 수동·E2E |
|---|---|---|
| 보상 1회 지급 | `engine.test.ts` 처치 보상 | 전투 표시와 숫자 체감 확인 |
| 동일 시간 결정론 | 20초 단일/분할 비교 | 브라우저 백그라운드 복귀 |
| 저장 RNG·치명타 | known vector, 999/1000ms draw 경계, 동일 seed·분할·reload/offline, 환생 sequence | 치명타 시각 피드백은 후속 이벤트 UI 티켓 |
| 결정론적 전투 이벤트 | 6종 event union, 고정 ordinal·ID, 발생 직후 snapshot, bounded merge, offline aggregate·비영속 저장, IRPG-411 최근 로그, IRPG-410 승패 queue·상세 | 실제 보조공학 조합의 외부 전문 감사 |
| 구매 원자성 | 성공·골드 부족 | 연속 클릭 탐색 테스트 |
| 스킬 잠금·비용 | 레벨·포인트 경계 | 잠금 사유 시각 확인 |
| 동료 영입·훈련·협공 | 첫 보스 경계, 비용·최대 rank, 3초 cooldown, 마무리 일격 단일 보상, RNG·분할 결정론 | 전투·오프라인 표시와 첫 영입 흐름 체감 확인 |
| 스테이지·패배 | 선택 범위·장시간 엔진, IRPG-410 패배 art·복귀/최고점 snapshot E2E | 장기 플레이 체감 확인 |
| 환생 유지·초기화 | 영구·임시 필드 비교 | 확인 대화상자와 예상 보상 |
| 환생 후 재도달 | 비동료·동료 20개 paired ratio 50~70%, exact timing·상태 hash·RNG, A/B 600초 중간 저장 재개 | IRPG-205 외부 사용자 체감 검증 |
| 결정론적 원정 이벤트 | v1 shuffle golden hash, 30-bit prefix, pending 3·overflow, 320개 선택 RNG 불변, 중복 no-write, 환생 폐기·MAX 거부, IRPG-412 pointer·keyboard·reload exact-once | 실제 보조공학 조합의 외부 전문 감사 |
| 저장 복구 | A/B fallback·부분 쓰기·미래 포맷·v1 migration | 실제 저장 차단 환경 |
| 저장 백업 | checksum·크기·schema·stale revision·read-back rollback, Playwright 다운로드·취소·복원 | 다른 기기 파일 이동 |
| 오프라인 중복 방지 | 같은 시각 재부팅, Playwright 닫기·재접속·재새로고침 | 탭 숨김과 OS 절전 복귀 |
| 다중 탭 충돌 | stale revision 원문 불변, reader 무쓰기, 동일 revision 충돌 차단, 두 페이지 lock 인계 | 비정상 브라우저 종료 복구 |
| 반응형·접근성 | progressbar·modal focus 컴포넌트 테스트, 360px·키보드·reduced-motion Playwright | 실제 보조공학 조합의 외부 전문 감사 |
| 시각 자산 | manifest validator fixture, production URL·gzip·lazy-load, 적·보스 8종·결과 2종·원정 이벤트 3종 stable mapping, 카드별 lazy-load, 360px·200%·fallback·A/B 저장 지속, IRPG-412 Ubuntu event baseline 8개 승인 | 외부 미술 방향 검토 |
| 첫 환생 목표 | 10회 결정론적 가속 세션과 대표 브라우저 상태 | IRPG-205 외부 사용자 10회 실제 플레이 |
| 장시간 결정론 | 1x·10x·100x 24시간 soak와 3×8시간 canonical 비교 | IRPG-507 브라우저 개발 패널, IRPG-508 7일 stress |
| 브라우저 debug 격리 | 순수 입력 경계, 실제 경과 배속, reader clone, legacy/A/B raw byte 불변 | development UI 1x·10x·100x·stage·자원·offline, production bundle·DOM 부재 |

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
- 불씨 정수 0·5·`Number.MAX_SAFE_INTEGER`의 4.2% 영구 능력치와 정수 포화
- 동료 잠금 stage 10/11, 훈련 비용보다 1 부족·정확히 일치, rank 1/5, cooldown 0/1,000/3,000ms
- 최대 안전 정수의 보상·경험치·처치·패배·스킬 포인트·환생 포화와 저장 가능 상태 유지

### 저장

- 키 없음, 빈 문자열, 잘못된 JSON
- 필드 누락, 음수·무한 숫자, 잘못된 버전
- localStorage 읽기·쓰기 예외
- A/B 슬롯 한쪽 손상, revision 동률·충돌, migration 실패
- 미래 envelope·state schema, schema1·2·3 A/B·portable migration, 잘못된 동료 ID·rank, 잘못된 RNG algorithm/state/draws, revision overflow, 과대 쿨다운 정규화, 저장소 read/write/remove 예외
- schema4→5 무소급 migration, stage/highest 불일치, 비연속 milestone mask, pending 0~3, overflow 0~27, future definitionVersion, resolved effect 변조, portable 과거 계보 rollback

## 5. 수동 브라우저 체크리스트

G4에서 아래 조합을 기록한다.

- Chrome·Edge 최신, 모바일 360×800, 데스크톱 1440×900
- 마우스 없이 Tab/Shift+Tab/Enter로 강화·스킬·스테이지 이동
- 200% 확대에서 가로 스크롤과 가려진 버튼 없음
- `prefers-reduced-motion`에서 지속 회전·pulse가 사실상 제거됨
- 탭을 1분 숨긴 뒤 복귀 시 시간 누락·중복 없음
- 저장 차단 시 경고가 보이고 게임은 계속 동작함
- 환생 확인에서 취소하면 어떤 상태도 바뀌지 않음
- 첫 보스 뒤 키보드로 동료를 영입·훈련하고 전투·오프라인 결과에서 협공 횟수와 피해를 확인
- 전투 로그를 키보드로 펼쳐 최근 20개·overflow·6종 label을 확인하고 filter 중 focus가 이동하지 않는지 확인

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
npm run test:assets
npm run assets:validate
npm run test:coverage
npm run build
npm run test:e2e
npm run test:e2e:assets
npm run test:e2e:visual
```

로컬 전체 게이트는 `npm run verify`다. 브라우저 제외 게이트는 `npm run verify:code`다. canonical screenshot 비교는 Ubuntu GitHub Actions 전용이며 로컬에서는 건너뛴다. 현재 픽스처 카탈로그는 IRPG-414의 `visual.dashboard.one-view` 4개 variant를 포함한 52개다. 각 variant는 먼저 정확한 360×800·1440×900에서 geometry·overflow·명령·motion을 검증하고, target이 viewport보다 길면 폭·DPR·media를 유지한 `captureViewport`로 높이만 늘려 full-surface를 캡처한다. artifact metadata는 `layoutViewport`·`captureViewport`·`expanded`를 구분한다. CI는 Chromium과 시스템 의존성을 설치한 뒤 worker 1개로 실행하며, 실패한 Playwright trace·screenshot·video와 HTML report를 artifact로 보존한다. 티켓을 Done으로 옮길 때 명령, 통과 결과, 필요한 수동 증거를 `Test evidence`에 남긴다.

## 8. 현재 브라우저 증거

- [데스크톱 전체 화면](../artifacts/desktop.png): 주요 패널, 보스 전투, 성장 버튼 렌더링 확인
- [390px 모바일 전체 화면](../artifacts/mobile.png): 단일 열 전환, 버튼·텍스트 가림 없음 확인
- 실제 Chrome에서 본문 존재, Vite 오류 overlay 없음, page error 없음 확인
- `불씨 검` 강화 비용이 18G에서 26G로 변경되고 새로고침 뒤에도 26G로 유지됨을 확인
- [IRPG-504 개발 서버 점검](../artifacts/irpg-504-dev-check.png): 본문·핵심 landmark·상호작용 요소 렌더링, Vite 오류 overlay와 console error 없음
- Playwright Chromium에서 신규→Lv.1 강화→reload 유지→1분 오프라인 보고→확인 후 reload 중복 없음 흐름 자동화
- [IRPG-403 360×800 전체 화면](../artifacts/irpg-403-360.png): 단일 열, 핵심 조작 44px, 텍스트·버튼 잘림 없음 확인
- IRPG-403 접근성 시나리오는 bundled Chromium, 설치된 Chrome, Edge에서 각각 2/2 통과했으며 page/console error가 없었다.
- IRPG-108 Playwright에서 360px 영입→협공→훈련→reload·reader 흐름과 1분 오프라인 협공 단일 정산을 포함한 전체 8/8이 통과했고 page/console error가 없었다.
- IRPG-407 Playwright에서 영웅 아렌의 1440px·360px·200% 배치와 corrupt WebP fallback을 4/4 검증했고, 일반 흐름 12/12와 production 자산 2/2가 통과했다.
- IRPG-507 Playwright에서 stage 300·1x/100x·자원·offline·잘못된 경계를 적용하고 5초 대기·pagehide·reload·reset 뒤 legacy/A/B raw byte 불변을 확인했다. 일반 흐름 13/13과 production debug 부재·자산 흐름 3/3이 통과했다.
- IRPG-411 Playwright에서 최근 20개·6종·filter·focus·reload/offline 비재생·200% 확대를 3/3 검증했다. 최종 로컬 `npm run verify`는 Vitest 169/169, 일반 Playwright 29/29, production 자산 3/3을 통과했고 Ubuntu quality push·PR와 canonical 32개·3회 반복도 성공했다.
- IRPG-410 Playwright에서 nonmodal 승패 상태·정확한 보상/복귀 snapshot·queue pin·reload/offline 비재생·fallback·200% 확대를 6/6 검증했다. 최종 로컬 `npm run verify`는 Vitest 243/243, 일반 Playwright 35/35, production 자산 4/4을 통과했고 GitHub push/PR quality run `29659072476`·`29659074246`, Ubuntu canonical 40/40·3회 반복 120/120 run `29659072473`도 성공했다.
- IRPG-412 Playwright에서 실제 자동 전투·강화 UI의 첫 이벤트 rapid 중복 입력→보상·revision·카드 제거 1회→reload 유지와 카드별 lazy request·fallback·keyboard focus·200% 확대를 2/2 검증했다. baseline commit `5df51fe`의 GitHub [push quality 29684456934](https://github.com/happypod/games01/actions/runs/29684456934)·[PR quality 29684458280](https://github.com/happypod/games01/actions/runs/29684458280)는 Vitest 285/285, 일반 Playwright 37/37, production 자산 4/4, 체크인 canonical 48/48을 통과했다. [visual run 29684456936](https://github.com/happypod/games01/actions/runs/29684456936)은 생성 48/48·3회 반복 144/144와 metadata artifact `8441669470` 업로드를 완료했다.

이 스크린샷은 자동 생성된 검증 증거이며 미술 방향의 최종 승인을 뜻하지 않는다.
