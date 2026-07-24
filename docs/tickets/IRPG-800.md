# IRPG-800 — 포획·생체카드·2.5D 캠프 확장 제품 범위

## Outcome

전투에서 포획 가능한 인간형·야수형 몬스터를 결정론적으로 포획해 생체카드(Living Card)로 관리하고, 이를 캠프에서 동료화·크래프팅·합동 연성(교배)에 활용하며, 캠프 화면을 2.5D 오브젝트 기반으로 확장하기 위한 제품 범위·비범위·후속 티켓 분해가 승인된다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Draft
- Skill tags: PROD-LOOP, NARRATIVE, ENG-STATE
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- CHAPTER I `sera` 전용 유대(Bond) 시스템(IRPG-425~428)과 신규 "포획 생체카드" 시스템의 관계를 명확히 한다: **사람형 캡티브(포로)는 기존 세라 패턴과 동일하게 18세 이상 확인 + 캐릭터별 별도 동의(`consentRequired`)를 계속 요구**하고, **야수형(몬스터) 캡처는 사람 대상 동의 절차 없이 포획/사육(taming) 프레이밍만 적용**한다. (`CHAPTER1_ADULT_CHARACTER_DEFINITIONS`가 이미 캐릭터별 `adult`/`consentRequired` 필드를 갖는 구조이므로 이를 그대로 확장한다.)
- 아래 후속 티켓으로 분해되는 전체 로드맵을 정의한다.
  1. IRPG-801 — 결정론적 포획 엔진 (`livingCards` 실제 상태화)
  2. IRPG-802 — LivingCardConsole 실데이터 연동 (가짜 데이터 제거)
  3. IRPG-803 — 2.5D 캠프 오브젝트 캔버스 (CampDashboard 옆에 신규 조감도 뷰 추가)
  4. IRPG-804 — 동료화·캠프 크래프팅·합동 연성(교배) 확장 (후속, 세부 설계 전 Blocked)
- 각 후속 티켓이 개별적으로 Definition of Ready를 만족하는 2~3일 크기인지 확인한다.
- 이미 커밋되지 않은 상태로 트리에 존재하는 임시 변경(`TacticalCardStage.tsx`의 `// Task 2` 주석 연결, `DirectHotbar.tsx`, `LivingCardConsole.tsx`)의 처리 방침을 정한다: `TacticalCardStage.tsx`는 IRPG-416/422 계열의 정식 연출로 흡수해 사후 티켓 참조를 남기고, `DirectHotbar.tsx`는 `TacticalActionBar.tsx`와 완전히 중복되므로 삭제하며, `LivingCardConsole.tsx`는 삭제하지 않고 IRPG-801/802에서 실데이터로 전환한다.

## Non-scope

- 신규 몬스터 종족의 실제 아트/콘텐츠 제작 (기존 GameAsset fallback으로 임시 대체)
- 완전한 교배(연성) 결과 콘텐츠와 보상 밸런스 수치 확정 (IRPG-804에서 별도 진행)
- 기존 `CampDashboard.tsx` 카드형 UI의 제거 (IRPG-803은 병행 추가, 교체는 후속 판단)
- Wartales 스타일 드래그 앤 드롭 배치 (1단계는 클릭 인터랙션만)

## Dependencies

- IRPG-425, 426, 427, 428 (CHAPTER I 유대·의상·합동 연성·시각 회귀)
- IRPG-700~704 (인벤토리·장비·스킬 슬롯, Schema 9)
- IRPG-104 (결정론적 시드 RNG), IRPG-106 (결정론적 전투 이벤트 스트림)

## Impacts

- Save schema: compatible — 후속 티켓에서 schema 10 → 11 migration 발생 예정 (IRPG-801)
- Content config: changed — `EnemyDefinition`에 species/capturable 필드 추가 예정
- Accessibility: none (이 티켓 자체는 범위 문서)

## Acceptance criteria

- Given 이 문서, when Owner/Reviewer가 검토하면, then 사람형 캡티브는 동의 기반, 야수형은 포획/사육 기반이라는 구분과 그 이유가 명시적으로 승인된다.
- Given IRPG-801~804 초안, when Definition of Ready 체크리스트와 대조하면, then 각 티켓이 2~3일 크기·Given/When/Then 수용 기준·의존성을 갖춘다.
- Given 커밋되지 않은 `TacticalCardStage.tsx`/`DirectHotbar.tsx`/`LivingCardConsole.tsx`, when 이 티켓이 Ready로 전환되면, then 각 파일의 처리 방침(흡수/삭제/실데이터 전환)이 후속 티켓에 반영되어 있다.

## Design

- 캐릭터별 동의 요구 여부는 `CHAPTER1_ADULT_CHARACTER_DEFINITIONS[id].consentRequired: boolean`로 표현하고, 야수형 개체는 애초에 이 맵에 등록하지 않는다 (몬스터는 `EnemyDefinition.species === 'beast'`이면 포획 시 동의 절차 자체가 없는 별도 경로).
- 인간형 신규 캡티브가 추가될 경우, Sera와 동일하게 `unmet -> rescued -> contracted` 유사 상태 + 별도 철회 가능 동의 + "철회 시 불이익 없음" 원칙을 그대로 승계한다 (IRPG-425 acceptance criteria 재사용).

## Verification

- Owner/Reviewer 서면 승인 (이 문서에 대한 리뷰 코멘트).

## Test evidence

- 해당 없음 (범위 문서, 코드 변경 없음).
