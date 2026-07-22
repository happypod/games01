# 검증·테스트 계획

## 1. 품질 전략

검증과 테스트를 구분한다.

- **검증(Verify)**: 구현이 제품·수식·상태 계약과 불변식을 만족하는지 확인
- **테스트(Test)**: 실제 코드와 브라우저를 실행해 실패·회귀·환경 차이를 찾음

도메인 단위 테스트를 중심에 두고, 저장 통합, React 컴포넌트, 실제 브라우저, 플레이테스트 순으로 범위를 넓힌다.

## 2. 자동 테스트 계층

| 계층 | 현재 | 검증 내용 |
|---|---:|---|
| 엔진 단위 | 구현 | 최초 상태, 보상, 결정론, 텐트별 경과 시간 상한, 구매 원자성, 캠프 시설·영구 훈련·치유 화로·고정 재료·단일 제작·회복 물약 빠른 슬롯·소모 버프·30분 상인·구조/계약/신뢰, 장비 드롭·이관·이동·장착·해제·포화 총량, 스킬·동료 잠금, 동료 영입·훈련·협공, 전투/캠프 전환·전경 정지·오프라인 mode 복원, 스테이지, 인벤토리·장비·스킬 슬롯을 보존하는 환생, 숫자 불변식 |
| RNG·치명타 | 구현 | xorshift32 vector, 1 draw/round, 일반 치명타 장비 bonus, 집중 물약 정확히 35%, 장비 드롭 독립 substream, 동일 seed·분할·offline·reload 실행·환생 연속성 |
| 전투 이벤트 스트림 | 구현 | skill·critical·companionAssist·kill·bossVictory·defeat 고정 순서, 단일·분할 ID, 최근 100개, MAX_SAFE 초과 cursor, 저장 비영속 |
| 저장 통합 | 구현 | A/B 교대, revision 선택·동률, 부분 쓰기, 손상 fallback, 미래 state·expedition·camp·bond·inventory definition 차단, 독립 legacy schema1~8→9 migration, strict item own ID·equipment slot·3개 고유 skill slot, 캠프·회복 물약 빠른 슬롯 포함 오프라인 진행 1회 적용, reader 무쓰기, 초기화 |
| 저장 전송 | 구현 | portable checksum·버전·크기, preview no-write, stale CAS, target rollback, export/import 브라우저 왕복 |
| UI 컴포넌트 | 구현 | 첫 화면 landmark, 전투/캠프 radiogroup·단일 활성 surface, 치유 화로·회복 물약 제작/장착/사용, 하단 고정 8슬롯, 현재 적과 지도·캐릭터·가방·스킬·도감 roving tab, 캠프 offer·갱신·세라 상태·자발적 계약 copy, 구매 불가 상태, 비영속 승패 queue·dedupe·pinned snapshot·focus 복원 |
| 밸런스 회귀 | 구현 | 고정 seed·3개 장비 전략·5~20초 판단 주기의 첫 환생 10세션과 비동료·동료 각 10개 paired 재도달 ratio, milestone, 정체, 숫자 불변식, 최종 상태 해시 |
| 브라우저 E2E | 구현 | 신규 시작, UI 강화, 전투→캠프 정지, 시설·훈련·치유·회복 물약 제작/장착/전투 사용·상인·자발적 계약, 실제 페이지 종료·오프라인 제작 완료·캠프 복원, 같은 구간 중복 방지, page/console error |
| 다중 탭 E2E | 구현 | 두 번째 탭 읽기 전용, 열린 reader 동기화, writer 종료 뒤 lock 인계 |
| 접근성 E2E | 구현 | 360px overflow·44px target·skip link·키보드 mode 명령·progressbar·modal focus·200% 확대·모션 감소 |
| 시각 자산 | 구현 | 필수 31 ID·로컬 경로·실제 포맷/픽셀/정규 LF 바이트·권리 metadata, SVG CRLF checkout 동치와 내용 변경 거부, fallback 2단계, production cold-load 600 KiB와 lazy namespace |
| 시각 회귀 | 구현 | Ubuntu 24.04·고정 Chromium/font/time/seed에서 19 named fixture × 4 viewport/motion variant = 76 canonical screenshot, 같은 runner 3회 반복 228개, state/event hash, overflow·motion, screenshot diff artifact |
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

IRPG-414 Done 기준선은 Vitest 36파일·297테스트, 자산 validator 32테스트, 일반 Playwright 40테스트, production 자산 Playwright 4테스트와 named fixture 13개·canonical screenshot 52개다. 1440×900·1024×768 문서 무스크롤 35/40/25 대시보드, 360×800 세로 흐름, 성장 탭 keyboard/ARIA, 현재 10단계 strip, 최근 5개 로그, 내부 pane 스크롤과 lazy namespace를 포함한다. Ubuntu workflow run `29689021639`에서 52/52 생성과 같은 runner 3회 반복 156/156을 통과했고 대표 기준선을 `design-qa.md`에 수동 검토했다. 기준선 commit `0d2b9da`의 push·PR quality-gate도 모두 통과했다.

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
| 환생 유지·초기화 | 영구·임시 필드 비교, `inventory`·`equipped`·`skillSlots` deep-clone 보존 | 확인 대화상자와 예상 보상 |
| 환생 후 재도달 | 비동료·동료 20개 paired ratio 50~70%, exact timing·상태 hash·RNG, A/B 600초 중간 저장 재개 | IRPG-205 외부 사용자 체감 검증 |
| 결정론적 원정 이벤트 | v1 shuffle golden hash, 30-bit prefix, pending 3·overflow, 320개 선택 RNG 불변, 중복 no-write, 환생 폐기·MAX 거부, IRPG-412 pointer·keyboard·reload exact-once | 실제 보조공학 조합의 외부 전문 감사 |
| 전투·캠프 활동 모드 | mode-only transaction, 캠프 60초 전경 정지, offline normal-engine 동치·mode 복원, 환생 시 캠프 기반 보존과 `BATTLE` 복귀 | 360×800·1440×900 전환 흐름의 수동 체감 확인 |
| 캠프 시설·영구 훈련 | 시설별 고정 비용, 캠프 전용 원자 transaction, 텐트 8~12시간 상한, 작업대 100~60%, 단련소 rank cap, +2 공격·+20 HP, vitality 회복, 환생 보존 | 비용·현재/다음 효과·잠금 사유와 44px 조작의 브라우저 확인 |
| 캠프 재료·제작·버프 | 모든 처치 ash +1, 늑대 hide +1, 보스 core +1, RNG 불변, 세 고정 레시피, 단일 job·시작 시간 snapshot·1ms 완료, 1,800-round gold +0.5, 다음 보스 최종 crit 정확히 35% | 실제 offline 종료·복원과 360px 키보드 제작·사용 흐름 |
| IRPG-700~702 인벤토리·장비 | schema8→9 무손실 기본값, strict ID/slot/skill 및 future fence, 일반 적 15%·보스 100% `equipment-loot-v1`, single/split/offline/reload exact ID/count와 기존 전투 1 draw/round 외 추가 draw 없음, 포화 잔여·총량 보존, HP 비회복, 환생 원장 보존 | Ubuntu quality `29944192954`와 visual `29944190250` 확인 완료; IRPG-424 실제 보조공학 감사와 최종 병합 검토 |
| IRPG-423 캠프 회복 | 잃은 HP 비율별 화로 비용 1~5, 캠프 전용 원자 완전 회복, 회복 물약 `{4,2,0}`·120초 exact-once 제작, 전투 최대 HP 35% 회복·수량 1 차감, 스테이지 선택 무료 회복/쿨다운 초기화 차단, schema6→7 원장 보존, Playwright 치유→제작→장착→피격→1회 사용 | 없음 — 화면 canonical은 IRPG-424가 소유 |
| 캠프 이벤트 상인·세라 | 30분 경계·분할 동치·RNG 불변, 3×3 고정 offer, cycle별 3-bit exact-once 구매, 비용-1·정확 일치, 구조→별도 계약, 신뢰 0~5 비용·0~10% 할인, reload·offline·portable·환생 원장 보존 | 360×800·1440×900에서 키보드 거래, 갱신·구매 완료·골드 부족·지원 완료·신뢰 MAX 상태와 비강압 copy 확인 |
| 저장 복구 | A/B fallback·부분 쓰기·미래 포맷·v1 migration | 실제 저장 차단 환경 |
| 저장 백업 | checksum·크기·schema·stale revision·read-back rollback, Playwright 다운로드·취소·복원 | 다른 기기 파일 이동 |
| 오프라인 중복 방지 | 같은 시각 재부팅, Playwright 닫기·재접속·재새로고침 | 탭 숨김과 OS 절전 복귀 |
| 다중 탭 충돌 | stale revision 원문 불변, reader 무쓰기, 동일 revision 충돌 차단, 두 페이지 lock 인계 | 비정상 브라우저 종료 복구 |
| 반응형·접근성 | progressbar·modal focus 컴포넌트 테스트, 360px·키보드·reduced-motion Playwright | 실제 보조공학 조합의 외부 전문 감사 |
| IRPG-424 전술 정보·명령 화면 | 과거 layout preference 무시, `.tactical-layout` 단일 분기, 장비3·스킬3·동료·회복 물약의 8슬롯 고정 순서, 강화/각인·동료·소모품 exact-once, 현재 적 고정 요약, 지도·캐릭터·가방·스킬·도감 controlled roving tab, 360·1024·1440px·200%·모션 감소·가방 focus E2E | Ubuntu 전체 canonical `76/76`·3회 `228/228`과 artifact diff 완료; 실제 보조공학 감사 |
| IRPG-422 유틸리티 도크 | 4개 accessible icon name, tooltip·단일 popover, 상세 heading focus, Escape/명시적 닫기 뒤 trigger focus 복귀, 외부 클릭 대상 focus 보존, 중첩 modal Escape 소유권, 기존 로그·결과·환생·백업 동작 | 실제 스크린리더에서 tooltip과 popover reading order 확인 |
| 시각 자산 | manifest validator fixture, production URL·gzip·lazy-load, 적·보스 8종·결과 2종·원정 이벤트 3종 stable mapping, 카드별 lazy-load, 360px·200%·fallback·A/B 저장 지속, IRPG-412 Ubuntu event baseline 8개 승인 | 외부 미술 방향 검토 |
| 첫 환생 목표 | 10회 결정론적 가속 세션과 대표 브라우저 상태 | IRPG-205 외부 사용자 10회 실제 플레이 |
| 장시간 결정론 | 1x·10x·100x 24시간 soak와 3×8시간 canonical 비교 | IRPG-507 브라우저 개발 패널, IRPG-508 7일 stress |
| 브라우저 debug 격리 | 순수 입력 경계, 실제 경과 배속, reader clone, legacy/A/B raw byte 불변 | development UI 1x·10x·100x·stage·자원·offline, production bundle·DOM 부재 |

## 4. 필수 경계값

### 시간

- 0ms, 음수, `NaN`
- 999ms / 1,000ms 라운드 경계
- 5초 오프라인 모달 경계
- 텐트 Lv.1~5의 정확한 8·9·10·11·12시간 / 각 상한 1ms 초과
- 캠프 전경 60초 동안 round·RNG·보상·cursor 불변 / 캠프에서 닫힌 1분은 offline 1회 정산 / 같은 `now` 재부팅은 0회
- 상인 갱신 30분-1ms / 정확히 30분 / 30분×3 단일·분할 호출 / `cycle = Number.MAX_SAFE_INTEGER`
- 저장 시각이 미래인 경우

### 경제·전투

- 비용보다 1 부족 / 정확히 일치 / 1 초과
- 적 HP가 피해와 정확히 같은 경우
- 플레이어 HP가 반격과 정확히 같은 경우
- 한 번에 여러 레벨 상승
- 최대 강화·스킬 랭크·최대 스테이지
- 불씨 정수 0·5·`Number.MAX_SAFE_INTEGER`의 4.2% 영구 능력치와 정수 포화
- 동료 잠금 stage 10/11, 훈련 비용보다 1 부족·정확히 일치, rank 1/5, cooldown 0/1,000/3,000ms
- 텐트·작업대·단련소 Lv.1→2 비용보다 1 부족·정확히 일치, Lv.5 재구매, 전투 모드 구매 거절
- 텐트 Lv.1~5의 8·9·10·11·12시간, 작업대 Lv.1~5의 100·90·80·70·60%, 단련소 Lv.1~5의 훈련별 rank 상한 5·10·15·20·25
- 공격 훈련 `round(140 × 1.45^rank)`과 체력 훈련 `round(160 × 1.45^rank)`의 비용·상한, rank당 +2 공격·+20 최대 HP와 현재 HP 안전 회복
- 모든 적·황혼의 늑대·보스 처치의 `ashShard/beastHide/emberCore` 정확 지급, 단일·분할·offline 동치와 RNG draw 불변
- 황금 스튜 `{10,4,0}`·5분, 집중 물약 `{6,2,1}`·10분의 비용보다 1 부족·정확 일치, 작업 중 재요청, 작업대 Lv.1~5 시작 시간 snapshot
- 제작 job 1,000/999/1ms와 초과 elapsed의 단일 완료, `BATTLE`·`CAMP`·offline timer 동치
- 황금 스튜 라운드 1·1,800·1,801, 캠프 전경 불소비, 기본 처치 골드 +50%와 boss milestone 불변, 활성 중 재사용 거절
- 집중 물약 unbound 일반 적 통과·다음 보스 bind, 동일 RNG draw에서 15% 실패/35% 성공 vector, 보스 승리·패배·stage 이탈·환생 종료, 준비/활성 중 재사용 거절
- 치유 화로 잃은 HP 0·1·20·21·100%의 비용 경계, 비용보다 재의 파편 1 부족·정확 일치, `BATTLE`·최대 HP·reader 거절과 RNG·보상 불변
- 회복 물약 `{4,2,0}`·120초의 비용보다 1 부족·정확 일치·119,999/120,000ms, 미장착·수량 0·최대 HP·`CAMP` 사용 거절, 전투 최대 HP 35% 반올림·상한·1개 차감
- 상인 cycle 0~2의 9개 고정 지급물·기본 비용, 슬롯별 mask 1·2·4와 중복 구매, 비용보다 1 부족·정확히 일치, cycle 경계의 mask 0 초기화
- 세라 `unmet → rescued → contracted`, 구조 지원 800G와 계약 분리, 신뢰 비용 `250·500·900·1,500·2,400G`, rank별 0·2·4·6·8·10% 할인과 rank 5 재시도
- 최대 안전 정수의 보상·경험치·처치·패배·스킬 포인트·환생 포화와 저장 가능 상태 유지

### 저장

- 키 없음, 빈 문자열, 잘못된 JSON
- 필드 누락, 음수·무한 숫자, 잘못된 버전
- localStorage 읽기·쓰기 예외
- A/B 슬롯 한쪽 손상, revision 동률·충돌, migration 실패
- 미래 envelope·state schema, schema1·2·3 A/B·portable migration, 잘못된 동료 ID·rank, 잘못된 RNG algorithm/state/draws, revision overflow, 과대 쿨다운 정규화, 저장소 read/write/remove 예외
- schema4→5 무소급 migration, stage/highest 불일치, 비연속 milestone mask, pending 0~3, overflow 0~27, future definitionVersion, resolved effect 변조, portable 과거 계보 rollback
- schema5→6 무소급 캠프 migration, reader 무쓰기·writer revision+1 checkpoint, 잘못된 mode·camp 필수 키·시설 1..5·훈련 `0..trainingGround × 5`, future camp definition의 A/B·legacy·portable 원문 보존과 write 차단
- schema6→7 원장 보존 migration, `healingPotion: 0`·`quickConsumable: null` 기본값, 세 소모품 필수 key, quick slot `null | healingPotion`, schema별 camp future fence
- 재료·소모품 필수 key 누락·음수·소수·MAX 초과, 알 수 없는 recipe, craft remaining 0·1·MAX, gold rounds 0·1,800·1,801, boss focus `null`·0·10·300과 일반 stage·범위 초과
- merchant cycle 음수·소수·MAX 초과, refresh remaining 0·1·1,800,000·초과, purchase mask 0·7·8, resident status 변조, 비계약 trust 1, 계약 trust 0·5·6

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
- 키보드로 전투↔캠프를 왕복해 한 surface만 표시되는지, 캠프의 정지 설명·마지막 전투 stage가 읽히는지, 360×800·200%에서 overflow와 가려진 44px 조작이 없는지 확인
- 캠프에서 텐트·작업대·단련소 확장과 공격·체력 훈련을 키보드로 실행해 골드·단계·현재/다음 효과가 함께 갱신되는지, 골드 부족·상한·reader에서 명확히 비활성화되는지 확인
- 캠프 보관함에서 세 재료 수량과 세 레시피 비용·남은 시간을 읽고, 키보드로 치유 화로·단일 제작·회복 물약 장착을 실행한 뒤 전투 하단 슬롯에서 1회 사용해 HP·수량·저장이 즉시 갱신되는지 확인
- 우측 현재 적 요약과 지도·캐릭터·가방·스킬·도감을 Arrow/Home/End로 전환하고, 미장착 빠른 슬롯의 `인벤토리 열기`가 가방 탭을 선택하는지 확인
- 저장된 제작 job을 둔 채 페이지를 닫고 경계 시간 뒤 다시 열어 offline에서 소모품이 정확히 한 번 완성되는지, 같은 시각 reload에서 재완료·오프라인 보고 중복이 없는지 확인
- 캠프 상인의 세 슬롯을 키보드로 구매해 완료 상태가 재입력을 막는지, 30분 갱신 뒤 새 cycle·가격·남은 시간이 표시되는지, 구조 지원 뒤에도 계약이 자동 체결되지 않고 별도 자발적 의사 확인과 보류 설명이 보이는지 확인
- 세라 계약 뒤 신뢰 0~5 비용과 2% 단위 할인이 모든 제안에 반영되고 신뢰 MAX·골드 부족·reader 상태가 명확히 비활성화되는지, 전투 동료 루미의 편성이 변하지 않는지 확인

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

로컬 전체 게이트는 `npm run verify`다. 브라우저 제외 게이트는 `npm run verify:code`다. canonical screenshot 비교는 Ubuntu GitHub Actions 전용이며 로컬에서는 건너뛴다. IRPG-415 Test 게이트는 기존 13개 fixture·52개 기준선을 수정하지 않고 `visual.dashboard.tactical-canvas`와 `visual.events.tactical-overlay`의 4개 variant씩을 추가해 15개 fixture·60개 canonical screenshot, 같은 runner 3회 반복 180개를 목표로 한다. 각 variant는 먼저 정확한 360×800·1440×900에서 geometry·overflow·명령·motion을 검증하고, target이 viewport보다 길면 폭·DPR·media를 유지한 `captureViewport`로 높이만 늘려 full-surface를 캡처한다. artifact metadata는 `layoutViewport`·`captureViewport`·`expanded`를 구분한다. CI는 Chromium과 시스템 의존성을 설치한 뒤 worker 1개로 실행하며, 실패한 Playwright trace·screenshot·video와 HTML report를 artifact로 보존한다. 티켓을 Done으로 옮길 때 명령, 통과 결과, 필요한 수동 증거를 `Test evidence`에 남긴다.

IRPG-416 Test 게이트는 기존 15개 fixture·60개 기준선을 그대로 보존하고 `visual.dashboard.tactical-damaged`와 `visual.dashboard.tactical-severe`의 4개 variant씩을 추가해 17개 fixture·68개 canonical screenshot, 같은 runner 3회 반복 204개를 요구한다. 단위 검사는 HP 70%·30% 경계와 잘못된 HP fail-safe, skill·critical 단일 primary popup, companion 별도 popup, boss/rank 필살기 조건, 실제 `advanceGame` kill·bossVictory snapshot의 다음 적 target 격리, popup 종료의 900ms scene 경계, scene 재생 중 저장 상태 불변을 고정한다. 일반 Playwright는 유형 1·2 damage asset 일치, 새 writer event의 공격·피격·협공·popup·flash, 360px reduced-motion 정적 수치와 overflow, effective 360px/200%에서 Damaged 초상과 정적 popup의 동시 배치를 검사한다. production 자산 Playwright는 stage 1 cold load에서 damage variant 요청이 0개인지 확인한다.

IRPG-417 Test 게이트는 canonical 개수를 17개 fixture·68개 screenshot으로 유지한다. 의미상 교체 범위는 저장 pending이 접힌 전장 우선 상태의 `visual.events.tactical-overlay` 4개와 Damaged·Severe 설명이 보이는 `visual.dashboard.tactical-{damaged,severe}` 8개다. 중첩 `overflow:hidden` 컨테이너의 잘못 남은 x/y offset을 수정한 뒤 기존 mobile 10개가 1px capture phase로만 재정렬되면 동일 크기·콘텐츠의 비교 증거를 남기고, 추가·누락 0개와 나머지 46개 byte-identical hash를 요구한다. 단위 검사는 최초·신규 pending의 기본 접힘, 토글 `aria-expanded`·`aria-controls`, 열린 base만 inert, 열기 첫 선택 focus·Escape 복귀·마지막 선택 전장 focus, rapid exact-once, 접힌 상태의 VFX 재생과 열린 동안 소비한 scene 비재생을 고정한다. 일반 Playwright는 실제 fixture에서 전장 노출→원정 3건 열기→연속 선택→전장 복귀와 유형 1·2 갑옷 손상 문구를 확인하고, 360×800에서 44px 토글·페이지 overflow·선택 버튼 geometry를 검사한다.

IRPG-417 단위 게이트에는 reader의 동일 pending + combat generation 증가 시 열린 overlay·focus 유지, `[A] → [A,B] → [B]` 합류·선택 전이, overlay 밖으로 이동한 focus를 신규 pending이 빼앗지 않는 경우를 포함한다.

IRPG-418 Done 게이트는 `src/game/campMode.test.ts`에서 mode-only 전환·중복 명령 거부, 캠프 전경 정지, offline normal-engine 동치와 mode 복원, 환생 보존 경계를 고정하고 `src/game/campPersistence.test.ts`에서 schema5→6 무소급 migration, reader 무쓰기·writer checkpoint, 캠프 offline exact-once, future camp definition fence를 검증한다. 컴포넌트·hook 테스트는 radiogroup 명령, 캠프 단일 surface, writer autosave 정지와 명령 직전 elapsed 정산을 포함한다. `e2e/camp.spec.ts`는 실제 UI와 고정 시계로 전투→캠프→6초 전경 정지→페이지 종료→1분 offline 정산→같은 시각 reload 무중복→전투 복귀를 지나며, 360×800 키보드 roving focus·44px target·가로 overflow·reduced-motion과 200% equivalent reflow를 검사한다. baseline commit `6c80e98`의 로컬·Ubuntu 전체 게이트가 통과했다.

IRPG-419 Done 게이트는 `src/game/campFacilities.test.ts`에서 시설 Lv.1~5 효과, 캠프 전용 원자 거래의 비용-1·정확 일치·최대 단계, 텐트 elapsed clamp, 공격·체력 flat 효과와 HP 회복, 훈련 상한, 환생 보존을 고정한다. debug offline도 실제 상태의 텐트 상한과 같은 engine path를 사용하며 A/B·portable·환생 보존을 함께 검사한다. 통합 브라우저는 텐트 Lv.4→5, 공격 훈련, 비용·MAX 문구와 reload를 조작한다. IRPG-418 Done 뒤 로컬 code/browser와 최종 canonical·CI를 통과했다.

IRPG-420 Done 증거는 고정 재료의 single/chunked·boss 경계와 RNG draw, 레시피 비용의 원자성·단일 job·시작 시 작업대 시간 snapshot, 999+1ms 정확 완료와 mode 독립 timer, 황금 스튜 1,800-round 수명·기본 처치 보상만 +50%, 집중 물약의 동일 RNG draw 15→35%·다음 보스 bind·종료를 검증한다. decoder는 조작된 job 시간이 recipe baseDuration을 넘거나 bound focus가 현재 활성 boss stage와 다르면 거부한다. hook은 명령 전에 elapsed를 정산하고 제작 완료를 polite status로 한 번 알린다. 통합 브라우저는 페이지 종료 중 제작 완료→재접속→reload 무중복을 통과했고 IRPG-419 Done 뒤 최종 canonical·CI를 통과했다.

IRPG-421 Done 게이트는 `src/game/campMerchant.test.ts`에서 30분 직전·정확 경계·3-cycle 분할 동치와 RNG 불변, 3-bit 구매 원장의 비용-1·정확 일치·중복 거절, 세라 구조 지원과 별도 자발적 계약, 신뢰 비용·10% 할인 상한, reload·offline·portable·환생 보존을 고정한다. 명령 전 elapsed로 오래된 offer 구매를 막고 terminal cycle 진입과 이미 terminal인 ledger 모두 single/split exact-once를 지킨다. consent·economy·accessibility 독립 리뷰와 실제 브라우저 구조→별도 계약→신뢰 할인→reload를 통과했고 IRPG-420 Done 뒤 최종 canonical·CI를 통과했다.

캠프 통합 시각 게이트는 신규 `visual.camp.resting` fixture의 360×800·1440×900 × default·reduced-motion 4개 variant를 추가해 전체 18개 fixture·72개 canonical screenshot과 같은 runner 3회 반복 216개를 요구한다. `e2e/camp.spec.ts`는 360×800 키보드·모션 감소와 1440×900의 200% equivalent viewport에서 가로 overflow·44px 조작·주요 heading 노출을 확인하고, `e2e/camp-management.spec.ts`는 시설·훈련·제작·상인·자발적 계약 흐름과 저장된 제작 job의 페이지 종료→offline 정확 1회 완료→reload 무중복을 브라우저 증거로 남긴다. [push quality `29743295721`](https://github.com/happypod/games01/actions/runs/29743295721), [PR quality `29743299219`](https://github.com/happypod/games01/actions/runs/29743299219), [visual `29743295715`](https://github.com/happypod/games01/actions/runs/29743295715)이 성공했고 artifact `8461530261`의 72개 PNG는 체크인 기준선과 72/72 byte-identical이다.

IRPG-422 게이트는 유형 1 대시보드와 레이아웃 선택 상태를 제거하고 전투 모드의 단일 전술 전장을 새 수용 기준으로 삼는다. IRPG-414~417 문서의 유형 1·2 비교와 당시 baseline 수치는 역사적 완료 증거로 보존하되, 이후 화면 회귀 판정에서는 IRPG-422가 이를 대체한다. 단위·컴포넌트 검사는 과거 `emberwatch.ui.layout.v1` 값 무시, 전투·캠프 분기, 8슬롯 고정 순서, 실제 manifest 자산 6개와 이미지 요청이 없는 소모품 아이콘 2개, 슬롯 상태·비용·효과 비교, 강화·각인 exact-once, 캠프 이동, 4아이콘 tooltip·단일 popover·Escape·외부 클릭·focus return을 고정한다.

일반 Playwright는 360×800·1024×768·1440×900과 effective 360px/200%에서 페이지 가로 overflow 없음, 최소 44px 조작 대상, DOM/키보드 읽기 순서, 전장·액션바·도크 배치, 캠프 왕복, 전투 로그·승패 결과·환생·내보내기·가져오기 실제 동작을 검증한다. reduced-motion에서는 상시 이동·flash를 제거한 정적 대체를 요구한다. production 자산 검사는 최초 전투에서 영웅·현재 적과 액션바의 6개 실제 자산만 eager이고, 소모품 이미지 요청과 비활성 지역·이벤트·damage/result 자산 요청은 disclosure 전 0개인지 확인한다. visual gate는 기존 18개 fixture·72개 canonical 이름과 variant 수를 유지하되 전투 fixture를 단일 전술 surface로 의도적으로 재승인하고, 캠프 fixture 및 저장 canonical의 비의도 변경이 없음을 hash·artifact metadata로 분리해 검토한다. `npm run verify` 뒤 push/PR quality와 Ubuntu visual 결과를 IRPG-422 `Test evidence`에 기록하기 전에는 Done으로 전환하지 않는다.

IRPG-422 병합 리뷰 보정 head `726f3ce2a25a5fa12646ae7ca247e75678fcb533`에서 모달 portal 실제 hit-test, reset/import tick 기준 재설정, 읽기 전용 CAMP export, 8슬롯 roving focus와 CAMP 전환 focus return을 추가로 고정했다. 로컬 게이트는 Vitest `404/404`, 일반 Playwright `61/61`, production asset `5/5`를 통과했고, [push quality `29887435986`](https://github.com/happypod/games01/actions/runs/29887435986), [PR quality `29887437893`](https://github.com/happypod/games01/actions/runs/29887437893), [Ubuntu visual `29887435978`](https://github.com/happypod/games01/actions/runs/29887435978)이 성공했다. visual artifact `8517169076`의 canonical `72/72`와 3회 반복 `216/216`은 기존 baseline을 보존한다.

IRPG-423 Done 증거는 치유 화로의 손실 HP별 비용 `1..5`, 재료 부족·최대 HP·BATTLE·reader no-write, 회복 물약 `{4,2,0}`·120초 제작의 1ms 경계와 exact-once, 빠른 슬롯 장착·해제·수량 0 유지, 전투 최대 HP 35% 회복·1개 차감, 스테이지 재선택의 HP·스킬·동료 cooldown 보존을 고정한다. schema6 raw·A/B·portable fixture는 기존 캠프·job·RNG·보상 원장을 보존하고 schema7의 `healingPotion: 0`과 `quickConsumable: null`만 추가한다. 독립 결정론·저장 리뷰에서 P0/P1은 없었고 `e2e/camp-recovery.spec.ts`의 치유→제작→장착→피격→전투 사용 흐름을 포함한 일반 Playwright `62/62`가 통과했다.

IRPG-424 Test 증거는 우측 성장 센터를 현재 적 고정 요약과 지도·캐릭터·가방·스킬·도감의 조회 중심 정보 레일로 바꾸고, 장비 3·스킬 3·동료 1·빠른 소모품 1의 mutation을 하단 8슬롯으로 단일화한 계약을 고정한다. 독립 React·접근성 리뷰의 모바일 가방 viewport P2를 활성 탭 focus·scroll 연동으로 수정했고 360×800, 1024×768, 1440×900, effective 360px/200%, reduced-motion과 keyboard roving 흐름이 일반 Playwright에서 통과했다. [PR quality `29944192954`](https://github.com/happypod/games01/actions/runs/29944192954)는 일반 Playwright `65/65`, production asset `6/6`, tracked Ubuntu visual `76/76`을 포함한 전체 게이트를 통과했다. [Ubuntu visual `29944190250`](https://github.com/happypod/games01/actions/runs/29944190250)은 전체 19 fixture의 canonical `76/76`과 3회 반복 `228/228`을 통과했다. 실제 보조공학 조합의 외부 전문 감사 전에는 Done으로 올리지 않는다.

IRPG-425 동의 게이트는 상점 조언 계약을 친밀 동의로 재사용하지 않는지, 미계약·미성인 확인·미동의·철회 상태에서 시설 명령이 입력 객체·RNG·재화·revision을 보존하는지 검증한다. 승인·철회·재동의는 CAMP 순수 명령과 저장 transaction을 통과하고, 성인 접근 해제는 활성 동의를 철회하되 신뢰·의상·연성 원장을 유지한다. 컴포넌트와 Playwright는 동의 문구·별도 실행·철회 불이익 없음·reader no-write를 확인한다.

IRPG-426 저장 게이트는 checked-in schema7 fixture를 schema8/camp definition v3으로 이행하면서 기존 시설·job·buff·상인·세라·RNG·전투·원정·보상 원장이 동일하고 bond 기본값만 추가되는지 고정한다. raw/A/B/portable reader는 원문을 쓰지 않고 writer만 반대 슬롯에 checkpoint하며, 잘못된 동의 조합·mask·잠긴/알 수 없는 의상·future bond/camp/state definition을 거부한다. asset gate는 기존 core ID와 `costume.chapter1.*`만 허용하고 manifest 값과 미등록 배포 파일 경로 모두에서 CHAPTER II·III를 차단하며, 제공 샘플 한 개의 768×768 WebP·250 KiB·SHA·권리·prompt record를 검증한다.

IRPG-427 결정론 게이트는 CAMP·동의·비용·미수령 조건의 경계를 순서대로 고정한다. 비용-1·unknown·duplicate는 입력 상태를 보존하고, 정확 비용은 900G·재의 파편 12·야수 가죽 6·불씨 핵 1과 수집 카드 bit를 정확히 한 번 교환한다. single/split elapsed, reload·offline·환생과 portable 왕복에서 claim이 보존되며 연성 전후 RNG state/draws·전투·원정·`getHeroStats`는 같다.

IRPG-428 일반 Playwright는 360×800과 1440×900에서 캠프 중앙 4개 roving tab의 Arrow/Home/End, 44px 조작, 가로 overflow 0, 동의→의상실 lazy-load→연성 committed→보상 dialog→reload 중복 거절→철회 원장 보존을 실제 A/B 저장 UI로 통과한다. reduced-motion에서는 JS 지연과 transform·flash 없이 동일 정적 보상 카드가 즉시 보이고 dialog Escape 뒤 trigger focus가 복귀해야 한다. production cold-load는 초기 전투·기본 캠프에서 의상 요청 0개, 동의 뒤 의상실 disclosure에서 샘플 한 개만 요청한다.

IRPG-428 Ubuntu visual gate는 안정된 최종 보상 상태 `visual.camp.bond-synthesis-reward` 한 fixture를 포함해 19 fixture × 4 variant = canonical 76개와 3회 반복 228개를 고정한다. canonical 생성 [run `29942940050`](https://github.com/happypod/games01/actions/runs/29942940050)의 artifact `8539290545`는 digest `sha256:1ae9b39ad27c9cf718bcdad52571ca43d43928ce09e90654914aceb34598941d`를 검증했고, 수동 diff는 동일 16개·의도 변경 60개·추가/누락 0개다. 이를 채택한 commit `059d42a`에서 [quality `29944192954`](https://github.com/happypod/games01/actions/runs/29944192954)의 tracked 비교 `76/76`과 [visual `29944190250`](https://github.com/happypod/games01/actions/runs/29944190250)의 생성 `76/76`·반복 `228/228`이 성공했다. 최종 artifact `8539741608`은 24,943,869 bytes, digest `sha256:40cdaa05b99334a4965d1622dd6b353c212c30ac5d9d6648064b6bd063e2bd4f`다.

IRPG-700~702 저장 게이트는 V1~V8을 현재 타입과 분리된 allow-list decoder로 읽고 각 migration 단계와 최종 schema9를 재검증한다. schema8→9는 기존 전투·캠프 v3·bond v1·원정·RNG·보상 값을 보존하면서 빈 삼원 인벤토리, 빈 네 장비 슬롯, `[powerStrike, null, null]`만 추가한다. schema9는 배열·prototype 상속 map, 미등록 ItemId, present key의 0·음수·비안전 정수 수량, 부위가 다른 장비, 길이가 3이 아닌 슬롯, 미지원·중복 SkillId를 거부한다. 0개는 key 삭제로만 표현한다. malformed 최신 A/B는 이전 유효 슬롯로 fallback하고 state·expedition·camp·bond·inventory의 더 높은 version은 raw·A/B·portable 쓰기를 모두 차단한다. schema8 camp definition v3은 정상 legacy로 허용하는 회귀를 별도 고정한다.

IRPG-702 결정론 게이트는 `equipment-loot-v1`의 일반 적 매 처치 15% COMMON 4종 균등·보스 매 처치 100% RARE 3종 균등을 exact item ID/count로 고정한다. encounter identity substream은 저장된 전투 RNG를 읽거나 전진시키지 않아 기존 1 draw/round 외 추가 draw가 없어야 하며 single/split/offline/reload와 영웅·동료 마무리 공통 처치 분기가 같은 결과를 내야 한다. 이관·이동은 registry own ID만 받고 `Number.MAX_SAFE_INTEGER` 여유만 옮기며 source 잔여와 ItemId별 총량을 보존한다. 장비 교환·해제 반환 공간이 없으면 입력 객체를 유지한다. 장비 HP는 현재 HP를 올리지 않고 새 상한으로만 clamp하며 집중 물약 bound 보스의 최종 임계값은 장비 bonus와 무관하게 정확히 0.35다. 환생 전후 `inventory`·`equipped`·고정 3-tuple `skillSlots` 값은 같고 참조는 분리되어야 한다. 슬롯 배치가 자동 시전을 제어하는 계약은 IRPG-704에서 검증한다.

IRPG-700~702는 2026-07-23 독립 리뷰의 P0/P1/P2를 모두 닫아 `Verify`로 승인한 뒤 Ubuntu 전체 실행 증거를 확보해 `Test`로 전환했다. IRPG-428 registry의 19 fixture·76 canonical 중 `visual.camp.bond-synthesis-reward` 4 variant를 추가하고 schema9·레이아웃 변화가 반영된 Ubuntu 기준선을 재확정했다. artifact 수동 diff는 동일 16개·의도 변경 60개·추가/누락 0개이며, 76개 모두 채택 commit `059d42a`와 byte-identical이다.

2026-07-23 보정 뒤 저장 표적 2파일·82/82, 엔진 38/38, 저장·엔진·집중 물약 묶음 4파일·127/127을 통과했다. `npm run verify:code`는 Vitest 51파일·482/482, asset validator 40/40, manifest 31 ID, lint·typecheck·production build를 통과했고, Chromium 일반 Playwright 65/65와 production asset 6/6도 통과했다. SVG checkout의 LF·CRLF canonical byte 동치와 EOL 정규화 뒤 실제 내용 변경의 `BYTES_MISMATCH`를 함께 고정하며 unsafe SVG·path escape·hash·권리 검사는 유지한다. 동일 수치는 Ubuntu [quality-gate #146](https://github.com/happypod/games01/actions/runs/29944192954)에서 재현됐고 tracked visual `76/76`도 통과했다.

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
- IRPG-415 최종 로컬 `npm run verify`는 Vitest 40파일/317개, manifest validator 32개, 일반 Playwright 51개, production 자산 Playwright 5개를 통과했다. [Ubuntu visual run 29696226574](https://github.com/happypod/games01/actions/runs/29696226574)는 canonical 60/60과 3회 반복 180/180을 통과했고, artifact `8445142347` 비교에서 기존 52개 변경·누락 0과 신규 Type 2 기준선 8개만 확인했다.
- IRPG-416은 로컬 `npm run verify:code`에서 Vitest 42파일/342개, manifest validator 33개, 자산 30 ID와 production build를 통과했고 일반 Playwright 54/54, production cold-load 5/5, capture geometry 영향 범위 39/39를 통과했다. [Ubuntu visual run 29714484979](https://github.com/happypod/games01/actions/runs/29714484979)는 canonical 68/68과 3회 반복 204/204를 통과했으며 artifact `8450148807` 비교에서 기존 60개 변경·누락 0과 신규 damage 기준선 8개만 확인했다. 기준선 commit `2ffbe64`의 [push quality 29714972850](https://github.com/happypod/games01/actions/runs/29714972850)·[PR quality 29714975078](https://github.com/happypod/games01/actions/runs/29714975078)과 [final visual 29714972818](https://github.com/happypod/games01/actions/runs/29714972818)이 통과했고, 최종 artifact `8450337243`의 digest는 `sha256:4bfc12b25aae9e0116f0030e3077fc36203a2f9f7c1d2db4bb73a78e661e3602`다.
- IRPG-417은 로컬 `npm run verify`에서 Vitest 42파일/353개, manifest validator 33개, 자산 30 ID, production build, 일반 Playwright 55/55와 production cold-load 5/5를 통과했다. `c573003`의 [Ubuntu acceptance run 29720587090](https://github.com/happypod/games01/actions/runs/29720587090)은 canonical 68/68과 3회 반복 204/204를 통과했고 artifact `8452362203` 비교는 추가·누락 0, 46개 동일, 12개 의미 변화, 10개 1px capture-phase 교정을 입증했다. 최종 baseline commit `20c4baf`의 [push quality 29725622587](https://github.com/happypod/games01/actions/runs/29725622587)·[PR quality 29725625067](https://github.com/happypod/games01/actions/runs/29725625067)과 [visual run 29725622560](https://github.com/happypod/games01/actions/runs/29725622560)이 통과했다. 최종 artifact `8454287692`는 21,776,723 bytes, digest `sha256:38fb377a654c5aad46f4bf1f430b84bf4f03b27596ca9286be0365556b1145f4`이며 다운로드한 PNG 68개가 tracked baseline과 68/68 byte-identical이다.
- IRPG-418~421은 로컬 `npm run verify`에서 Vitest 47파일/395개, manifest validator 33개, 자산 30 ID, production build, 일반 Playwright 60/60, production cold-load 5/5를 통과했다. baseline commit `6c80e98`의 [push quality 29743295721](https://github.com/happypod/games01/actions/runs/29743295721)·[PR quality 29743299219](https://github.com/happypod/games01/actions/runs/29743299219)과 [visual run 29743295715](https://github.com/happypod/games01/actions/runs/29743295715)이 성공했다. visual artifact `8461530261`은 24,562,655 bytes, digest `sha256:6800d82922f9cc19905c63e9826ee6f7b0cc90d61a31300e5c752a646084af49`이며 72/72 생성·216/216 반복과 다운로드한 72개 PNG의 체크인 기준선 byte-identical을 확인했다.

이 스크린샷은 자동 생성된 검증 증거이며 미술 방향의 최종 승인을 뜻하지 않는다.
