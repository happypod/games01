# IRPG-304 — 저장 내보내기·검증 후 가져오기

## Outcome

사용자가 진행을 JSON 파일로 백업하고, 손상되거나 호환되지 않는 파일이 현재 저장을 덮지 않는다는 보장 아래 복원한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ENG-SAVE, UX-FEEDBACK, QA-DOMAIN, QA-E2E
- Owner / Reviewer: Codex / save safety review

## Scope

- portable payload v1: 제품 식별자, export version, export 시각, `GameState`, 상태 checksum
- 1 MiB 상한 뒤 `unknown`에서 버전·필드·checksum·상태 schema를 검증하는 parser
- 파일 다운로드와 JSON 파일 선택 UI
- 검증 성공 뒤 레벨·스테이지·재화·내보낸 시각을 보여 주는 미리보기와 명시적 확인
- IRPG-305 writer lock과 기대 revision을 사용하는 commit
- 가져온 상태의 `lastSavedAt`을 확인 시각으로 옮겨 과거 오프라인 구간 재수령 방지

## Non-scope

- 클라우드 업로드, 암호화, 비밀번호, 다른 계정 간 서버 전송
- 파일 안의 revision 복원, 여러 저장 병합, 임의 텍스트 편집기
- 알 수 없는 미래 export/state version을 추측해 변환

## Dependencies

- IRPG-303 A/B 저장·decoder·migration
- IRPG-305 단일 writer와 기대 revision guard
- schema 1 portable fixture; IRPG-104에서 schema 2 migration 회귀 대상으로 유지

## Impacts

- Save schema: compatible; local A/B envelope는 유지하고 별도 portable export v1 추가
- Content config: none
- Accessibility: 파일 선택·오류·preview·확인 결과를 이름과 live status로 제공

## Acceptance criteria

- Given 유효한 현재 상태일 때, when 내보내고 같은 파일을 parser로 읽으면, then checksum이 일치하고 핵심 진행 상태가 동일하다.
- Given 잘못된 JSON, 1 MiB 초과, checksum 불일치, 필드 누락, 미래 export/state version일 때, when 가져오기를 준비하면, then 오류를 표시하고 A/B 슬롯 원문과 revision은 바뀌지 않는다.
- Given 유효한 파일을 선택했을 때, when 확인 전이거나 취소하면, then 현재 메모리 상태와 저장 원문은 바뀌지 않는다.
- Given preview를 확인하는 동안 다른 writer가 새 revision을 기록했을 때, when commit하면, then stale import를 거부하고 최신 검증 상태를 표시한다.
- Given writer가 유효한 preview를 확인했을 때, when commit과 read-back이 성공하면, then 외부 revision을 복사하지 않고 local revision+1로 기록하며 reload 후 복원 상태가 유지된다.
- Given 오래된 backup을 현재 시각에 가져왔을 때, when 즉시 reload하면, then export 이후 경과 시간을 오프라인 보상으로 다시 지급하지 않는다.

## Design

portable JSON은 `{ kind, exportVersion, exportedAt, state, checksum }`이다. checksum은 보안 서명이 아니라 잘림·우발적 편집을 탐지하는 고정 FNV-1a 식별자다. parser는 전체 문자열 크기를 먼저 제한하고 raw `state` 직렬화의 checksum을 확인한 뒤 공용 상태 decoder·migration을 통과시킨다.

파일 선택은 어떤 저장 API도 호출하지 않는다. 성공 preview는 메모리에만 보관되고 확인 버튼이 `restoreGame(state)`를 호출한다. hook은 writer 여부를 재검사하고 imported state를 복제해 `lastSavedAt=Date.now()`로 바꾼 뒤 `saveGameAtRevision`을 한 번 호출한다. 현재 winner는 반대 슬롯의 rollback 복구본으로 남는다.

## Verification

- Review: 독립 저장·UI 리뷰에서 비동기 파일 선택 역전, commit read-back 실패 뒤 높은 revision 잔존, mutable preview, modal 뒤에 가려진 실패 메시지를 발견했다.
- Verify: 파일 선택마다 단조 token을 발급해 마지막 선택의 read 결과만 채택하고 `file.text()` 예외를 사용자 메시지로 변환한다.
- Verify: slot write/read-back 검증 실패 시 target의 이전 raw를 복원하며, import 직전 preview checksum·state schema·exportedAt을 다시 검증한다.
- Verify: parser와 preview/cancel은 storage API를 호출하지 않는다. commit은 현재 local 기대 revision만 사용하고 imported state의 `lastSavedAt`을 확인 시각으로 변경한다.
- Verify: 실패 modal은 닫혀 최신 reader 상태와 오류가 보이며, 취소는 별도 상태 문구를 남긴다.

## Test evidence

- `src/game/saveTransfer.test.ts`: portable round-trip, checksum, 1 MiB, 미래 export/state, invalid state, local revision+1, 과거 시각 재설정, stale CAS, mutable preview 재검증
- `src/game/persistence.test.ts`: write 성공 뒤 read-back 실패와 truncated write에서 target raw rollback
- `src/components/SaveTransferPanel.test.tsx`: 느린 이전 파일이 최신 preview를 덮지 않음, file read 실패 안내
- `e2e/save-transfer.spec.ts`: 다운로드→reset→invalid reject→reload no-write→valid preview→cancel no-write→confirm→reload 복원
- `npm run verify` (2026-07-17): lint, strict typecheck, Vitest 7 files / 42 tests, production build, Playwright 3/3 통과
