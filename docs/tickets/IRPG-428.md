# IRPG-428 — 특수 시설 연출·접근성·Ubuntu 시각 회귀

## Outcome

캠프 특수 시설이 모바일·키보드·모션 감소 환경에서 동의 상태를 명확히 표시하고, 합동 연성 성공을 실루엣·불꽃·보상 카드로 안전하게 전달한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Test
- Skill tags: FE-GAME, UX-FEEDBACK, A11Y, QA-E2E, REL-CI, ART-2D
- Owner / Reviewer: Codex / independent React, accessibility and visual review

## Scope

- 유대 훈련실·의상실·합동 연성실을 캠프의 접근 가능한 tab/tabpanel로 구성한다.
- 실제 영웅·세라 자산 실루엣, Font Awesome 불꽃 아이콘, 저장 성공 뒤에만 열리는 고정 보상 카드 연출을 추가한다.
- `prefers-reduced-motion`에서는 transform·flash를 제거하고 즉시 읽을 수 있는 정적 상태로 대체한다.
- 360×800, keyboard, 저장·reload, Playwright와 Ubuntu visual fixture를 확장한다.

## Non-scope

- 노골적 샘플 CG 제작, 자동 재생 성행위 연출, 오디오·진동
- CHAPTER II·III 이미지·CG·fixture·preload
- 연출에서 엔진 보상을 다시 지급하거나 저장 state를 직접 변경

## Dependencies

- IRPG-403, IRPG-506, IRPG-425, IRPG-426, IRPG-427

## Impacts

- Save schema: none beyond IRPG-426
- Content config: Chapter I sample costume mapping
- Accessibility: keyboard, focus return, live status, reduced motion review required

## Acceptance criteria

- Given 키보드 사용자, when 시설 tab에서 Arrow/Home/End와 Tab을 사용하면, then 단일 roving tab stop과 연결된 tabpanel·명확한 이름을 유지한다.
- Given 360×800 또는 200% equivalent viewport, then 가로 overflow 없이 동의·의상·연성 조작이 44px 이상으로 노출된다.
- Given 연성 저장이 committed 되었을 때만, then 실루엣·불꽃·보상 카드가 한 번 나타나고 Escape/닫기로 trigger focus가 복귀한다.
- Given reduced motion, then 합성 이동·불꽃 pulse가 실행되지 않고 같은 보상 텍스트와 카드가 즉시 보인다.
- Given reload·reader·save failure, then 연출이 보상을 추론하거나 재생하지 않고 저장 원장을 그대로 표시한다.
- Given 초기 전투·기본 캠프, then 샘플 의상 이미지를 요청하지 않고 동의 후 의상실을 열 때 CHAPTER I 샘플 한 개만 lazy-load한다.
- Given Ubuntu visual gate, then 19 fixture × 4 variant = 76 canonical과 3회 반복 228장이 통과한다.

## Design

시설 선택과 연출 phase는 비영속 React 상태다. 엔진 명령이 `committed`를 반환한 뒤에만 UI phase를 시작한다. 샘플은 완전 착의·비노골적 CHAPTER I 세라 의상 한 개이며 추가 CG는 사용자 가이드 경로만 제공한다.

## Verification

- 독립 리뷰에서 보상 모달이 시각 캡처에서 누락되던 P1을 찾아 모달을 열린 채 `.bond-reward-backdrop` 전체와 실제 보상 아트 로드를 캡처하도록 수정했다.
- 같은 리뷰에서 18세 자기 확인, 계약 전 접근 해제, 공유 tabpanel, 보이는 fallback focus와 안정된 modal callback을 보강했고 재검토 결과 남은 코드 P0/P1/P2는 없다.
- 1440×900·360×800 실제 브라우저 감사에서 overflow 0, 44px 미만 시설 조작 0, 이미지 잘림·겹침 없음과 모바일 1열 재배치를 확인했다.
- `visual.camp.bond-synthesis-reward` 신규 4개 variant를 포함한 Ubuntu 24.04 전체 canonical `76/76`과 3회 반복 `228/228`이 통과했다. tracked 기준선 비교와 artifact 검토까지 완료해 실행 검증 단계인 `Test`로 전환한다.

## Test evidence

- 2026-07-23 로컬 게이트에서 lint·typecheck, Vitest 51파일/482개, 일반 Playwright 65/65, production 자산 Playwright 6/6, 자산 계약 40/40, manifest 31 ID와 build가 통과했다.
- `e2e/bond-facilities.spec.ts` 3/3이 360px·키보드·A/B reload·exact-once·계약 전 접근 해제·reduced-motion을 통과했고 production cold-load는 동의 전 요청 0→의상실 공개 뒤 샘플 1개만 요청했다.
- fixture registry는 19개 × 4 variant = canonical 76장, 3회 반복 228장 계약을 고정한다. [Ubuntu visual `29944190250`](https://github.com/happypod/games01/actions/runs/29944190250)은 `76/76`·`228/228`을 통과했고 artifact `8539741608`의 digest는 `sha256:40cdaa05b99334a4965d1622dd6b353c212c30ac5d9d6648064b6bd063e2bd4f`다.
- canonical 생성 실행 `29942940050`의 artifact `8539290545`를 내려받아 SHA-256을 검증하고 76개 PNG를 수동 검토했다. 기존 저장소 대비 동일 16개·의도 변경 60개·추가/누락 0개였으며, 채택 commit `059d42a`와 76/76 byte-identical이다.
- [PR quality `29944192954`](https://github.com/happypod/games01/actions/runs/29944192954)의 tracked Ubuntu visual `76/76`과 전체 품질 게이트가 통과했다. 자산 validator `40/40`은 CHAPTER II·III 자산·fixture 0개 계약을 유지한다.
