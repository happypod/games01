# IRPG-413 — 일반 적·보스 일러스트 세트

## Outcome

현재 일반 적 5종과 보스 3종이 각 안정 ID의 일러스트로 표시되고 이미지 실패에도 적 이름·HP·boss 상태가 유지된다.

## Priority / Status / Skill tags

- Priority: P2
- Status: Done
- Skill tags: ART-2D, FE-GAME, UX-FEEDBACK
- Owner / Reviewer: Codex implementation / independent art direction and accessibility review

## Scope

- 일반 적 archetype 5개와 보스 3개 각각의 고유 768×768 WebP portrait
- current enemy panel 연결과 boss emphasis
- 360px·데스크톱 crop, loading·error fallback, 최적화
- built-in image generation prompt·export recipe·project-owned 권리 기록

## Non-scope

- 신규 적 능력·패턴·전투 수식
- 영웅·장비 외형, 스킨·가챠, 프레임 애니메이션
- 승리·패배 결과 화면

## Dependencies

- IRPG-102 현재 적·보스 content
- IRPG-403 접근성 기준선
- IRPG-406 asset manifest

## Impacts

- Save schema: none
- Content config: 기존 적·보스 stable visual ID의 placeholder를 final asset으로 교체
- Accessibility: 텍스트 이름이 권위 정보이며 decorative art가 알림을 중복하지 않음
- Files: `ash-slime`, `twilight-wolf`, `abandoned-armor`, `charred-shaman`, `abyss-sentinel`, `ash-giant`, `eclipse-knight`, `forgotten-dragon`의 고유 WebP
- Fixtures: 고정 시각 debug session의 stage `1..5`, `10`, `20`, `30`; stage 1 corrupt response; 360×800·1440×900·200% 확대

## Acceptance criteria

- Given 등록된 적·보스일 때, when 해당 전투를 열면, then 각 안정 ID의 올바른 일러스트와 기존 이름·boss 상태가 함께 표시된다.
- Given 자산 누락·decode 실패·느린 load일 때, when 전투가 진행되면, then fallback이 크기 이동 없이 표시되고 전투·저장이 중단되지 않는다.
- Given 360×800·1440×900·200% 확대일 때, when 일반 적과 boss 화면을 확인하면, then HP·이름·스테이지 이동을 가리거나 가로 overflow를 만들지 않는다.
- Given production build일 때, when asset budget을 검사하면, then 모든 portrait가 manifest의 768×768 WebP·250 KiB 상한과 lazy-load 계약을 통과한다.
- Given stage `1..5`, `10`, `20`, `30` fixture일 때, when mapping을 검사하면, then 8개 이름·stable ID·고유 배포 파일이 정확히 1:1로 연결되고 다른 portrait를 대신 사용하지 않는다.
- Given 스크린리더·reduced-motion일 때, when 전투를 탐색하면, then decorative art가 적 이름을 중복 발화하거나 신규 지속 motion을 만들지 않는다.

## Design

기존 `EnemyDefinition.assetId`를 유지하고 이름과 수치는 HTML 텍스트로 표시한다. 비현재 전투 대상은 첫 화면에서 요청하지 않는다. stage 1의 `enemy.ash-slime`만 첫 route에서 hero와 함께 eager 요청하고, 나머지 7개는 해당 stage를 처음 열 때 동적 import한다.

공통 미술 방향은 charcoal·ash brown 배경, 한 방향의 restrained ember rim, reward gold와 제한된 teal 보조광, 중앙 70% 안의 한 대상, 작은 화면에서도 읽히는 외곽선이다. 일반 적은 낮거나 비대칭인 실루엣, 보스는 더 큰 질량과 명확한 외곽선으로 구분한다. 배경은 조용한 연기·재 질감만 사용하며 텍스트·UI frame·logo·watermark·고어·절단·기존 IP 모방을 금지한다.

5개 일반 적은 낮은 ember-core slime, 마른 황혼 늑대, 사람이 없는 속 빈 갑주, 굽은 masked ash shaman, teal aperture의 obsidian sentinel로 구분한다. 3개 보스는 화산석 재의 거인, eclipse halo의 중장 기사, 접힌 날개의 고대 재룡으로 구분하며 영웅 아렌과 혼동되는 rust-red scarf를 보스 기사에 사용하지 않는다.

각 자산은 built-in image generation으로 별도 생성하고 opaque source를 Pillow Lanczos로 center-fit 768×768 RGB WebP quality 82·method 6으로 내보낸다. `status: ready`, 실제 bytes, generator와 하나의 versioned prompt record를 manifest에 기록한다.

## Verification

- 8개 콘텐츠 매핑, 작은 portrait crop 일관성, 일반/보스 실루엣 차이, 대비·fallback과 bundle 예산을 Review했다.
- AI 생성 결과의 대상 수·해부·프레임·텍스트 artifact를 원본과 104/116px 실제 표시 크기에서 각각 검사했다. `charred-shaman`과 `forgotten-dragon`은 92%, `eclipse-knight`는 87.5% 안전 축척으로 원형 crop 안에 세부를 보존했다.
- 독립 미술 방향 재검토와 기술 감사에서 잔여 P0·P1·P2가 모두 0임을 확인했다.

## Test evidence

- `npm run verify` (2026-07-18): ESLint·strict TypeScript·Vitest 20파일/127테스트·자산 validator 21테스트·manifest 27 ID·production build 통과
- 일반 Playwright 17/17: 8종 desktop capture와 stable mapping, 일반/보스 360×800·200%·reduced-motion geometry, corrupt enemy decode 뒤 fallback·전투·실제 A/B autosave 지속 통과
- production 자산 Playwright 3/3: dist 경계, production debug UI 부재, 600 KiB cold-load 예산과 비현재 적·보스 lazy namespace 통과
