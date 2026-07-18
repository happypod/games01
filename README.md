# Emberwatch — 방치형 RPG 뼈대

브라우저에서 바로 실행되는 로컬 우선 방치형 RPG 수직 프로토타입입니다. UI와 게임 엔진을 분리해 전투·성장·저장·오프라인 진행을 순수 함수로 검증할 수 있습니다.

## 현재 플레이 가능한 범위

- 1초 단위 자동 전투와 10스테이지마다 등장하는 보스
- 골드·경험치·레벨 성장, 장비 3종 강화
- 자동 공격 스킬 1종과 패시브 스킬 2종
- 첫 보스 승리 뒤 `불씨 여우 루미` 영입·훈련과 3초 자동 협공
- 최고 스테이지 선택, 패배 시 이전 스테이지 자동 파밍
- 30스테이지 이후 환생과 영구 자원 `불씨 정수`
- 브라우저 A/B 자동 저장, legacy schema1·2 마이그레이션, 손상 슬롯 복구, 최대 8시간 오프라인 진행
- Playwright Chromium으로 신규→강화→재접속→오프라인 중복 방지 전체 흐름 검증
- 데스크톱·모바일 반응형 UI, 모션 감소 설정 지원

서버 계정, 결제, 광고, 가챠, PvP, 길드, 클라우드 저장은 현재 범위가 아닙니다.

## 시작하기

Node.js 22.12 이상이 필요합니다.

### Windows 원클릭 실행

저장소 루트의 [`게임실행.cmd`](게임실행.cmd)를 더블클릭합니다. 첫 실행에는 패키지를 자동으로 설치하고, 준비가 끝나면 실제 게임 주소를 기본 브라우저로 엽니다. 종료할 때는 실행 창에서 `Ctrl+C`를 누릅니다.

### 터미널에서 실행

```bash
npm ci
npm run dev
```

게임 플레이만 할 때는 Playwright 브라우저 설치가 필요하지 않습니다. 전체 품질 게이트를 처음 실행할 때는 `npx playwright install chromium`을 한 번 실행합니다. Linux와 CI에서는 시스템 의존성까지 설치하는 `npx playwright install --with-deps chromium`을 사용합니다.

품질 게이트 전체 실행:

```bash
npm run verify
```

개별 명령은 `lint`, `typecheck`, `test`, `test:soak`, `test:coverage`, `test:e2e`, `test:e2e:headed`, `test:e2e:ui`, `build`, `preview`입니다. 브라우저를 제외한 빠른 게이트는 `npm run verify:code`로 실행합니다.

## 문서 지도

| 문서 | 목적 |
|---|---|
| [제품 명세](docs/PRODUCT.md) | 핵심 루프, 범위, 경제, 수용 시나리오 |
| [아키텍처](docs/ARCHITECTURE.md) | 상태 모델, 의존 방향, 게임 루프, 저장 전략 |
| [로드맵](docs/ROADMAP.md) | 단계별 목표와 릴리스 게이트 |
| [다음 콘텐츠·시각 로드맵](docs/NEXT_CONTENT_ROADMAP.md) | 캐릭터·맵·카드·이벤트·승패 화면 구현 순서 |
| [스킬 정리](docs/SKILLS.md) | 제작 역량 태그와 게임 내 스킬 설계 |
| [티켓 백로그](docs/BACKLOG.md) | 우선순위, 상태, 의존성, 수용 기준 |
| [테스트 계획](docs/TEST_PLAN.md) | 자동·수동 검증 범위와 추적성 |
| [기여 절차](CONTRIBUTING.md) | 설계 → 구현 → 검증 → 테스트 흐름 |

## 코드 구조

```text
src/
  game/          순수 도메인 엔진, 콘텐츠, 수식, 저장 어댑터
  hooks/         실제 시계·자동 저장과 React 연결
  components/    화면 패널과 표시 컴포넌트
  test/          Vitest/jsdom 테스트 설정
e2e/             실제 Chromium 핵심 사용자 흐름
docs/            제품·기술·운영 계약
.github/         CI와 티켓 템플릿
```

밸런스 수치는 [content.ts](src/game/content.ts), 파생 공식은 [formulas.ts](src/game/formulas.ts), 상태 전이는 [engine.ts](src/game/engine.ts)에 집중되어 있습니다.
