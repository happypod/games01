# IRPG-303 — A/B 슬롯·revision·migration

## Outcome

저장 도중 한 슬롯이 손상되거나 이전 v1 저장이 남아 있어도 보상 중복과 진행 손실 없이 가장 최근의 검증된 상태를 복구한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ENG-SAVE, QA-DOMAIN
- Save schema: legacy raw v1 → envelope format v2

## Scope

- `emberwatch.save.v2.a/.b` 교대 슬롯
- envelope `revision`, `savedAt`, read-back 검증
- 높은 revision → 높은 savedAt → A 순서의 결정론적 선택
- 손상 최신 슬롯 fallback과 다음 저장 치유
- 정적 v1 fixture migration
- 미래 format 덮어쓰기 차단
- legacy/A/B 전체 초기화

## Non-scope

- 다중 탭 compare-and-swap와 읽기 전용 전환: IRPG-305
- 사용자 내보내기·가져오기: IRPG-304
- 서버 저장

## Acceptance criteria

- A rev1 → B rev2 → A rev3으로 저장되며 직전 유효 슬롯이 백업으로 남는다.
- 최신 슬롯이 손상되면 이전 유효본을 선택하고 복구 사실을 표시한다.
- revision 동률은 savedAt과 A 슬롯 순으로 결정하며 상태를 병합하지 않는다.
- v1 fixture는 v2 기록 검증 뒤에만 legacy 키에서 제거된다.
- 쓰기 실패·silent no-op·미래 포맷에서 기존 유효 데이터가 덮어써지지 않는다.
- 오프라인 진행은 fallback/migration 뒤에도 같은 시간 구간에 한 번만 적용된다.

## Verification

- GameState schemaVersion은 1로 유지하고 저장 topology만 formatVersion 2 envelope로 분리했다.
- active pointer 없이 슬롯 자체의 revision을 단일 선택 근거로 사용한다.
- write 대상은 항상 현재 승자의 반대 슬롯이며 성공 판정 전에 원문 일치와 decoder 통과를 확인한다.
- 미래 formatVersion을 감지하면 bootstrap은 저장 불건강 상태를 노출하고 어떤 슬롯도 갱신하지 않는다.
- localStorage 읽기 오류와 미래 포맷은 세션 저장 latch를 차단한다. 명시적 초기화가 모든 키를 지운 경우에만 latch를 해제한다.
- 독립 리뷰에서 자동 저장·명령 저장·페이지 생명주기 저장이 모두 같은 보호 latch를 통과하고 기존 진행을 덮어쓸 경로가 없음을 확인했다.

## Test evidence

- `src/game/persistence.test.ts`: 교대 revision, 최신 선택, 손상 fallback, 동률, v1 migration, 부분·무시 쓰기, migration 재시도, 미래 포맷, 읽기·삭제 오류, revision overflow, 전체 초기화
- `src/hooks/useGame.test.tsx`: 읽기 오류로 보호 모드가 된 세션은 저장소가 회복돼도 자동 저장하지 않음을 확인
- 정적 fixture: `src/game/fixtures/legacy-save-v1.json`
- `npm run verify`: lint, strict typecheck, Vitest 5개 파일 28개 테스트, production build 통과
- `npm run test:coverage`: statements 93.42%, branches 87.95%, functions 97.91%, lines 95.60%
