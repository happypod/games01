# IRPG-426 — CHAPTER I 의상 원장·자산 manifest·schema8 migration

## Outcome

CHAPTER I 의상 선택과 해금 원장이 저장·A/B·portable 복원 뒤에도 보존되고, 배포 자산은 manifest와 검증기를 통해 CHAPTER II·III 유입을 차단한다.

## Priority / Status / Skill tags

- Priority: P1
- Status: Done
- Skill tags: ENG-SAVE, ENG-DATA, ART-DIR, QA-DOMAIN
- Owner / Reviewer: Codex / independent save and asset review

## Scope

- schema7/camp definition v2를 schema8/camp definition v3으로 이행한다.
- 안정된 CHAPTER I 의상 콘텐츠 ID, 현재 의상, 해금 bit 원장과 합동 연성 보상 원장을 추가한다.
- `costume.chapter1.*` manifest 규칙과 비노골적 세라 샘플 CG 한 개를 추가한다.
- manifest 값과 미등록 배포 파일 모두에서 CHAPTER II·III 식별자·경로를 거부한다.
- 사용자 추가 자산의 규격·권리·hash·prompt record 절차를 문서화한다.

## Non-scope

- 저장에 파일 경로·manifest asset ID·이미지 bytes 기록
- CHAPTER II·III 자산 생성·매핑·preload·배포·visual fixture
- 샘플 한 개를 넘는 신규 이미지/CG 제작

## Dependencies

- IRPG-303, IRPG-304, IRPG-406, IRPG-423, IRPG-425
- checked-in schema7 fixture와 기존 envelope v3 / portable v1 계약

## Impacts

- Save schema: schema7 → schema8 migration required
- Content config: camp definition v3, Chapter I costume definitions v1
- Accessibility: 의상 이름과 선택 상태를 텍스트로 노출

## Acceptance criteria

- Given 유효한 schema7 raw/A/B/portable 저장, when 읽으면, then 기존 전투·캠프·RNG·보상 원장을 보존하고 기본 동의·의상 원장만 추가한다.
- Given reader 탭 migration, then 원문을 쓰지 않고 writer만 반대 슬롯에 schema8 checkpoint를 기록한다.
- Given 잠긴·알 수 없는·CHAPTER II·III 의상 ID, when 선택·복원하면, then 상태를 바꾸지 않거나 저장을 거부한다.
- Given manifest 또는 배포 파일 경로에 CHAPTER II·III가 포함되면, then asset gate가 실패한다.
- Given 제공 샘플, then 768×768 WebP·250 KiB 이하·권리·prompt·SHA가 일치하고 추가 생성 자산은 0개다.

## Design

저장에는 `chapter1.sera.field` 같은 시맨틱 콘텐츠 ID만 둔다. UI용 manifest ID 매핑은 immutable content definition이 소유하며 실제 경로는 manifest에만 존재한다. 미래 camp definition과 state schema는 기존 future fence를 유지한다.

## Verification

- checked-in schema7 fixture를 field-by-field 비교해 기존 전투·캠프·RNG·원장과 A/B revision을 보존하고 비활성 bond 기본값만 추가함을 확인했다.
- 배포 트리 감사에서 신규 이미지는 768×768·49,366 byte CHAPTER I 완전 착의 세라 WebP 한 장뿐이며, CHAPTER II·III 파일·ID·prompt·fixture는 0개다.
- 독립 저장·자산 리뷰에서 schema8 decoder, nested future fence, 시맨틱 ID와 manifest 매핑에 남은 P0/P1/P2가 없음을 확인했다.

## Test evidence

- schema7 raw/A/B/portable migration과 reader no-write·writer checkpoint·future fence를 포함한 게임 계층 18파일/257개 및 핵심 저장 5파일/111개 테스트가 통과했다.
- 자산 계약 테스트 38/38, production manifest 31 ID, production cold-load Playwright 6/6과 build가 통과했다.
- 사용자 추가 절차는 `docs/assets/CHAPTER1_CUSTOM_CG_GUIDE.md`, 샘플 생성·hash 증거는 `docs/assets/prompts/chapter1-sera-ember-bond.md`에 고정했다.
