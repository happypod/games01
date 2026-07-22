# IRPG-425 — CHAPTER I 성인 동의 계약·캠프 특수 시설

## Outcome

성인 캐릭터 세라와의 유대 콘텐츠는 별도의 명시적·철회 가능한 동의를 거친 뒤에만 열리고, 사용자는 불이익 없이 언제든 철회할 수 있다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: PROD-LOOP, ENG-STATE, NARRATIVE, FE-GAME, A11Y
- Owner / Reviewer: Codex / independent consent and accessibility review

## Scope

- 캠프에 `유대 훈련실`, `의상실`, `합동 연성실` 세 특수 시설을 추가한다.
- 상점 조언 계약과 분리된 로컬 18세 이상 확인, 세라의 명시적 동의, 철회·재동의 상태를 저장한다.
- 유대 시설의 친밀 콘텐츠는 CHAPTER I의 성인 캐릭터만 대상으로 하며 사용자가 명시적으로 열기 전에는 표시·로드하지 않는다.
- 철회는 신뢰·재화·해금·보상 원장을 회수하거나 전투 성장에 불이익을 주지 않는다.

## Non-scope

- 미성년 또는 연령이 불명확한 캐릭터, 강제·포획·노예·소유·위계 강요·취약 상태의 동의, 거절·철회 불이익
- 자동 동의, 계약 상태를 친밀 동의로 간주, 숨겨진 성인 콘텐츠 노출
- CHAPTER II·III의 이미지·CG·asset ID·경로·프롬프트·시각 fixture

## Dependencies

- IRPG-403, IRPG-418, IRPG-421, IRPG-424
- 세라는 명시적으로 성인이고 `contracted`는 상점 조언 계약일 뿐 친밀 동의가 아니라는 제품 계약

## Impacts

- Save schema: IRPG-426에서 schema8 migration required
- Content config: CHAPTER I adult consent definition v1 추가
- Accessibility: 상태 설명, 철회·재동의, keyboard focus review required

## Acceptance criteria

- Given 세라가 미계약이거나 18세 이상 확인이 꺼져 있을 때, when 동의를 요청하거나 시설을 실행하면, then 입력 상태·RNG·재화·revision을 바꾸지 않고 이유를 설명한다.
- Given 성인 확인과 별도 세라 동의가 모두 있을 때, when 시설을 열면, then 세 시설을 사용할 수 있고 상점 계약과 별도 상태로 표시한다.
- Given 동의된 상태일 때, when 철회하면, then 즉시 시설 실행을 막되 신뢰·의상 해금·연성 원장·재화에는 불이익이 없다.
- Given 철회 상태일 때, when 사용자가 다시 명시적으로 동의하면, then 재동의 후에만 시설이 다시 열린다.
- Given CHAPTER II 또는 III 식별자를 입력할 때, then 어떤 콘텐츠도 등록·로드·저장하지 않는다.

## Design

동의는 `adultAccessConfirmed`와 `seraConsent`의 두 단계다. `contracted`는 진입 선행 조건이지만 동의를 대체하지 않는다. 시설 선택은 비영속 UI 상태이며, 동의·철회만 순수 엔진 명령과 기존 저장 transaction을 통과한다.

## Verification

- 구현 전 제품 계약에서 강제·소유·거절 불이익은 계속 금지하고, 성인 간 명시적·철회 가능한 CHAPTER I 콘텐츠만 별도 범위로 승인했다.
- 독립 React·동의·접근성 리뷰에서 18세 자기 확인 문구, 계약 전 접근 해제, tabpanel 연결, 모달 복귀 포커스와 callback 안정성을 보강한 뒤 P0/P1/P2가 없음을 재확인했다.
- 1440×900과 360×800 실제 브라우저 감사에서 가로 overflow 0, 44px 미만 시설 조작 0, 동의 카드와 1열 모바일 재배치를 확인했다.

## Test evidence

- `src/game/campBond.test.ts`, `src/components/CampSpecialFacilities.test.tsx`, `src/components/CampDashboard.test.tsx`, `src/hooks/useGame.test.tsx`가 실패 명령 불변·별도 동의·철회·계약 전 접근 해제와 UI 연결을 고정한다.
- `e2e/bond-facilities.spec.ts` 3/3이 18세 확인→세라 동의→reload, 계약 전 접근 해제와 reduced-motion 경로를 통과했다.
- 2026-07-22 최종 `npm run verify`에서 lint·typecheck, Vitest 51파일/461개, 일반 Playwright 65/65가 통과했다.
