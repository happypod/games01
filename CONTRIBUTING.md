# 작업 절차

## 1. 티켓부터 시작

1. [백로그](docs/BACKLOG.md)에서 선행 작업이 끝난 티켓을 고른다.
2. [티켓 템플릿](docs/TICKET_TEMPLATE.md)으로 Outcome, 범위, 수용 기준, 저장·콘텐츠 영향을 채운다.
3. Definition of Ready를 만족한 뒤에만 `In Progress`로 옮긴다.

## 2. 설계

- 상태와 명령 계약을 먼저 작성한다.
- 밸런스 값은 UI나 엔진 분기에 흩뿌리지 않고 `content.ts`와 `formulas.ts`에 둔다.
- 저장 필드 변경은 버전·migration·이전 fixture를 함께 설계한다.
- UI는 정상·잠금·부족·오류·최대 상태를 모두 정의한다.
- RNG와 시간은 재현 가능한 테스트 대역을 먼저 정한다.

## 3. 구현

- `src/game`은 React, DOM, 브라우저 타이머를 import하지 않는다.
- 상태 변경은 순수 명령 함수가 새 `GameState`를 반환하도록 한다.
- 계산 가능한 능력치는 저장하지 않고 파생한다.
- 기존 사용자 저장을 깨는 변경을 migration 없이 병합하지 않는다.
- unrelated 리팩터링은 별도 티켓으로 분리한다.

## 4. 검증

Review 뒤 Verify에서 다음을 확인한다.

- 수용 기준과 코드 경로가 1:1로 추적되는가
- HP·재화·시간·스테이지 불변식이 유지되는가
- 오프라인과 온라인 규칙이 불필요하게 갈라지지 않았는가
- 저장·환생의 유지 필드와 초기화 필드가 명시적인가
- 잠금·오류·실패 경로가 사용자에게 드러나는가

## 5. 테스트

변경에 맞는 최소 단위 테스트를 추가하고 전체 게이트를 실행한다.

```bash
npx playwright install chromium
npm run verify
```

`npm run verify`는 lint, strict typecheck, Vitest, production build, Playwright Chromium E2E를 순서대로 실행한다. 브라우저 설치가 필요 없는 중간 점검은 `npm run verify:code`를 사용한다.
Linux와 CI에서는 Chromium 시스템 의존성까지 준비하도록 `npx playwright install --with-deps chromium`을 사용한다.

- 엔진·수식 변경: 경계값과 장시간 불변식
- 저장 변경: round-trip, 손상 데이터, migration, 중복 재개
- UI 변경: role/name 기반 컴포넌트 테스트, 모바일·키보드 수동 확인
- 핵심 흐름 변경: 브라우저 E2E

## 6. 완료

티켓의 Verification과 Test evidence를 채우고 Definition of Done을 모두 만족한 뒤 `Done`으로 이동한다. 데이터 손실, 보상 중복, 진행 차단 결함은 알려진 문제로 남겨 둔 채 릴리스하지 않는다.
