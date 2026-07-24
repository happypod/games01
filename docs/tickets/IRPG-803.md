# IRPG-803 — 2.5D 캠프 오브젝트 캔버스

## Revision note (R1)

최초 구현(Test 상태로 커밋된 버전)은 조감도를 "조감도 보기" 토글 뒤에 숨기고, 건물 클릭이 기존 카드의 확장 동작을 그대로 트리거하는 얕은 버전이었다. 실제 화면을 확인한 Owner가 Wartales/Raid 실제 스크린샷을 근거로 다음을 명확히 요구해 범위를 다시 잡는다.

1. 조감도가 **캠프 진입 시 기본 화면**이어야 한다(토글 뒤에 숨기지 않는다).
2. 건물을 클릭하면 **그 자리에서 바로 동작이 실행되는 게 아니라 팝업/모달이 열려** 정보와 조작을 보여줘야 한다.
3. 사이드바에 항상 떠 있던 제작(작업대)·훈련(단련소) 섹션은 **팝업으로 이관 후 사이드바에서 제거**한다(Owner 확정 답변).
4. 유대 훈련실·의상실·합동 연성실(기존 상단 탭 3개)도 **세라 액터를 건물화**해 그 팝업 안으로 흡수한다(Owner 확정 답변).

아래 Scope/Non-scope/Acceptance criteria/Design은 이 R1 방향으로 다시 작성한 것이다.

## Outcome

캠프 모드 진입 시 기본 화면이 2.5D 건물 배치 캔버스이고, 텐트·작업대·단련소·세라·상인 건물/액터를 클릭하면 해당 건물의 실제 조작 UI가 팝업으로 열린다. 사이드바에는 즉시성이 중요한 치유·소모품 장착만 남고, 제작·훈련·유대·상점 UI는 전부 건물 팝업으로 이동한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Test
- Skill tags: FE-GAME, UX-FEEDBACK, A11Y, ART-2D, QA-E2E
- Owner / Reviewer: Lead Builder / Project Owner

## Scope

- `src/components/CampCanvas.tsx`: `CampDashboard`의 기본(유일한) 캠프 화면이 된다. 토글 제거.
  - 건물/액터 5종을 절대 좌표(%)에 실제 `<button>`으로 배치: 텐트, 작업대, 단련소, 세라(상태 `!== 'unmet'`일 때만), 떠돌이 상인(신규 오브젝트).
  - 각 건물 클릭 시 **직접 명령을 호출하지 않고** 해당 팝업을 연다(`openPopup('tent' | 'workbench' | 'trainingGround' | 'sera' | 'merchant')`).
- 신규 팝업 컴포넌트(전부 `role="dialog"`, 포커스 트랩, Escape로 닫기 — 기존 `TacticalIntelPanel`의 장비 선택 dialog·`ExpeditionEventPanel` 오버레이 패턴 재사용):
  - `TentPopup.tsx`: 레벨, 효과, 확장 버튼(기존 카드 내용 이관).
  - `WorkbenchPopup.tsx`: 레벨/확장 버튼 + 기존 `camp-storage-summary`(가방·보관함 요약) + 기존 `camp-crafting`(재료 보유량, 레시피 3종, 제작 진행) 섹션 전체 이관.
  - `TrainingGroundPopup.tsx`: 레벨/확장 버튼 + 기존 `camp-training`(공격·체력 훈련) 섹션 이관.
  - `SeraPopup.tsx`: 기존 `camp-resident`(구조/계약 안내, 신뢰 활동) 섹션 + 내부 소형 탭 전환으로 기존 `CampSpecialFacilities`(유대 훈련실/의상실/합동 연성실)를 그대로 재사용해 호스팅. 바깥 `CAMP_CENTER_TABS`는 제거하고 이 내부 탭이 대신한다.
  - `MerchantPopup.tsx`: 기존 `camp-merchant`(상인 제안 목록, 갱신 타이머) 섹션 이관.
- `src/components/CampDashboard.tsx`: `camp-rest`(휴식 패널) + `CampCanvas` + 슬림해진 `camp-command` aside(요약 dl, 치유 화로, 배틀 서플라이, 안전 정지 안내)만 남긴다. `CAMP_CENTER_TABS`, `campViewMode` 토글, 시설 카드 그리드, storage/merchant/resident 섹션, training/crafting aside 섹션을 제거한다.
- `src/game/camp.ts`: 기존 헬퍼(`getCampStructureUpgradeCost`, `getCampMerchantOffers`, `getSeraTrustCost` 등) 재사용, 새 engine 명령 없음.

## Non-scope

- Drag & Drop 배치 (클릭/키보드 활성화만)
- 신규 배경·오브젝트 스프라이트 아트 제작 (기존 `GameAsset` fallback 사용)
- 포획한 몬스터/생체카드 액터의 캠프 내 배치 (IRPG-804)
- 치유 화로·배틀 서플라이(빠른 소모품 장착) 섹션 이동 — Owner가 "제작/훈련"만 명시했으므로 aside에 그대로 둔다.
- 신규 팝업 애니메이션/트랜지션 연출 (Non-scope, 접근성 있는 정적 모달로 충분)

## Dependencies

- IRPG-419, IRPG-424, IRPG-425, IRPG-403, IRPG-506
- 기존 `CampSpecialFacilities.tsx`/`SynthesisRewardDialog.tsx` (변경 없이 재사용)

## Impacts

- Save schema: none
- Content config: none
- Accessibility: review 필요 — 5개 신규 모달의 포커스 트랩·복귀 포커스·Escape 처리·`aria-labelledby`가 기존 `TacticalIntelPanel` 장비 모달과 동일 수준을 만족해야 한다.
- **회귀 위험**: IRPG-414가 "패널을 열지 않고 바로 조작"을 데스크톱 목표로 삼았던 것과 반대 방향이다(제작/훈련이 이제 팝업을 열어야 조작 가능). Owner가 이 트레이드오프를 명시적으로 승인함.

## Acceptance criteria

- Given 캠프 모드 진입, when 화면을 보면, then 토글 없이 바로 2.5D 건물 캔버스가 기본 화면으로 보인다.
- Given 텐트/작업대/단련소/상인 건물 클릭 또는 Enter, when 활성화되면, then 즉시 업그레이드/구매가 실행되지 않고 해당 팝업이 열린다.
- Given 작업대 팝업이 열림, when 레시피 제작 버튼을 누르면, then 기존 `onStartCraft` 핸들러가 그대로 호출되고 기존 카드형 UI와 동일한 비활성 조건(재료 부족 등)을 보인다.
- Given 세라 상태가 `unmet`, when 조감도를 보면, then 세라 건물이 보이지 않는다. Given `rescued` 이상, when 세라 건물을 클릭하면, then `SeraPopup`이 열리고 내부 탭으로 유대 훈련실/의상실/합동 연성실을 오갈 수 있다.
- Given 임의의 팝업이 열려 있음, when Escape를 누르거나 닫기 버튼을 누르면, then 팝업이 닫히고 포커스가 해당 건물 버튼으로 복귀한다.
- Given 키보드 사용자, when Tab으로 순회하면, then 모든 건물이 포커스 가능한 `<button>`이고, 팝업 내부는 포커스 트랩이 걸린다.
- Given 기존 `CampDashboard.test.tsx`의 치유 화로·배틀 서플라이 테스트, when 이 티켓 이후 실행하면, then 변경 없이 통과한다(aside에 남은 부분은 회귀 없음).

## Design

- 각 팝업은 `state`와 필요한 핸들러만 받고, 표시에 필요한 파생값은 팝업 내부에서 기존 `game/camp.ts`/`game/formulas.ts` 헬퍼로 직접 계산한다(Props 폭발 방지, `CampSpecialFacilities`가 이미 쓰는 패턴과 동일).
- `SeraPopup`의 내부 탭 전환은 기존 `CAMP_CENTER_TABS`의 roving-tabindex 코드를 그대로 옮겨 재사용한다(새로 설계하지 않음).
- Raid: Shadow Legends 마을 화면 참조(이전 라운드에서 이미 반영): 건물마다 원형 상태 배지 + 알약형 이름/레벨 라벨. 상단 자원 바·모드 전환 버튼은 기존 것을 그대로 사용.

## Verification

- 구현 완료: `CampBuildingModal.tsx`(공유 모달 셸, 기존 `useModalFocus`/`SynthesisRewardDialog` 패턴 재사용) + `TentPopup`/`WorkbenchPopup`/`TrainingGroundPopup`/`SeraPopup`/`MerchantPopup` 5개 신규 팝업.
- `CampCanvas.tsx`는 이제 어떤 engine 명령도 직접 호출하지 않고 `openPopup` 로컬 상태만 바꾼다. 실제 명령 호출은 전부 팝업 내부 버튼에서 일어난다.
- 시설 헬퍼(`getCampFacilityNextEffect`/`getCampFacilityCurrentEffect`), 공용 라벨(`CAMP_MATERIAL_LABELS`), 캠프 전용 카운트다운(`formatCampCountdown`, 기존 `game/format.ts`의 `formatDuration`과 의도적으로 분리 — 후자는 `OfflineReport.tsx`가 쓰는 다른 포맷이라 충돌 방지)을 `game/camp.ts`로 이관해 카드형 코드가 완전히 사라지고 팝업들이 공유한다.
- `CampDashboard.tsx`는 `camp-rest` + `CampCanvas` + 슬림 `camp-command`(요약/치유 화로/배틀 서플라이만)로 축소. `CAMP_CENTER_TABS`, 카드/캔버스 토글, 시설 그리드, storage/merchant/resident 섹션, 사이드바 훈련/제작 섹션 전부 제거.
- `SeraPopup`은 기존 `CampSpecialFacilities`를 그대로(로직 변경 없이) 재사용하고, 제거된 바깥 탭의 roving-tabindex 코드를 내부 3-tab(유대 훈련실/의상실/합동 연성실)으로 그대로 옮김.
- **실브라우저 수동 확인**(`npm run dev`, 진행 중이던 실제 세이브로 확인): 캠프 진입 시 토글 없이 바로 캔버스가 보임 → "불씨 작업대" 클릭 → 팝업이 즉시 열리고 레벨(1/5)·현재 효과·확장 버튼(골드 부족으로 정확히 비활성)·보관함 요약·재료 3종·레시피 3종(회복 물약만 재료 충분해 "제작" 활성, 나머지 "재료 부족")이 전부 실제 상태값으로 표시됨을 확인 → Escape로 팝업이 닫히고 트리거 버튼으로 포커스가 복귀함을 접근성 트리로 확인.

## Test evidence

- `src/components/CampCanvas.test.tsx` 전면 재작성(7개 케이스: 기본 렌더링·팝업 미개방, 텐트 확장이 팝업 내부에서만 호출, 작업대 팝업 보관함/레시피 내용, 단련소 팝업 onTrain 호출, 상인 팝업 onPurchaseMerchantOffer 호출, Escape 닫기+포커스 복귀, 세라 unmet 숨김/disabled 전파/rescued 표시).
- `src/components/CampDashboard.test.tsx` 갱신: 기존 치유 화로·배틀 서플라이 테스트 3개는 무변경으로 유지(회귀 없음 증명), 제작 레시피 테스트는 작업대 팝업을 여는 흐름으로 수정, 바깥 탭 roving-focus 테스트는 삭제하고 세라 팝업 내부 roving-focus 테스트로 대체, 캔버스가 토글 없는 기본 화면임을 확인하는 테스트 추가.
- `npm run verify:code` 로컬 실행 결과: lint/typecheck 통과, **Test Files 53 passed / Tests 507 passed**, asset manifest 40 케이스, production build 성공. 전부 첫 실행에 통과(회귀 없음).
- 아직 사람 Reviewer 검토 전이라 Status는 `Test`로 두고 `Done` 전환은 Owner/Reviewer 확인 후 진행한다.
