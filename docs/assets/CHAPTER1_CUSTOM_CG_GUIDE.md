# Chapter I 사용자 의상·CG 추가 가이드

이 가이드는 Emberwatch의 성인 캐릭터용 선택 콘텐츠를 사용자가 직접 추가할 때 지켜야 할 저장·자산·동의 경계다. 현재 저장소가 제공하는 신규 샘플은 `costume.chapter1.sera.ember-bond` 한 장뿐이다.

## 고정 범위

- 활성 콘텐츠 범위는 `CHAPTER I`뿐이다. 3개 원정 지역도 모두 Chapter I 내부 지역이다.
- Chapter II·III의 이미지와 CG는 ID, 파일 경로, prompt record, 미등록 배포 파일을 포함해 저장소에 넣지 않는다.
- 등장인물은 명백한 성인이어야 하며, 캐릭터의 독립적인 명시적 동의와 사용자의 성인 접근 확인 뒤에만 자산을 공개한다.
- 동의 철회는 언제든 가능하고 보상 회수, 진행 손실, 가격 불이익을 만들지 않는다.
- 강요, 소유, 강제 구속, 거절 불이익, 미성년자 또는 연령이 불분명한 인물은 허용하지 않는다.

## ID와 저장 경계

현재 샘플의 세 계층은 다음과 같다.

| 역할 | 값 |
|---|---|
| 저장되는 시맨틱 의상 ID | `chapter1.sera.field` |
| 표시 계층의 manifest asset ID | `costume.chapter1.sera.ember-bond` |
| 배포 파일 | `src/assets/game/files/costume/chapter1/sera-ember-bond.webp` |

`GameState`와 portable backup에는 시맨틱 의상 ID와 해금 원장만 저장한다. manifest ID, `.webp` 경로, URL은 저장하지 않는다. `src/game/camp.ts`의 `CHAPTER1_COSTUME_DEFINITIONS`가 시맨틱 ID를 manifest asset ID로 연결한다.

추가 asset ID는 아래 패턴만 허용된다.

```text
costume.chapter1.<adult-character-slug>.<costume-slug>
```

파일은 반드시 아래 경로에 둔다.

```text
src/assets/game/files/costume/chapter1/<filename>.webp
```

## 새 자산 추가 절차

1. 원본의 제작자, 생성 도구 또는 라이선스와 재배포 권리를 먼저 확보한다. 생성 자산은 정확한 prompt record를 `docs/assets/prompts` 아래에 남긴다.
2. 명백한 성인, 독립적 동의, Chapter I 맥락을 확인한다. 자산 자체에는 텍스트, 로고, UI, 워터마크를 넣지 않는다.
3. 중앙 70% 안전 영역을 지키는 768×768 WebP, 250 KiB 이하로 내보낸다.

```powershell
python tools/assets/export-portrait.py <source-image> src/assets/game/files/costume/chapter1/<filename>.webp --safe-scale 0.92
Get-Item src/assets/game/files/costume/chapter1/<filename>.webp | Select-Object Length
Get-FileHash src/assets/game/files/costume/chapter1/<filename>.webp -Algorithm SHA256
```

4. `src/assets/game/manifest.json`에 고유한 로컬 파일과 권리 metadata를 등록한다.

```json
{
  "id": "costume.chapter1.<adult-character-slug>.<costume-slug>",
  "kind": "costume",
  "status": "ready",
  "src": "./files/costume/chapter1/<filename>.webp",
  "format": "webp",
  "width": 768,
  "height": 768,
  "bytes": 0,
  "sourceType": "generated",
  "author": "<author>",
  "license": "project-owned",
  "generator": "<generator and export recipe>",
  "promptRecord": "docs/assets/prompts/<record>.md",
  "sha256": "<64 lowercase hexadecimal characters>"
}
```

예시의 `bytes`, ID, 경로, prompt record와 SHA-256은 새 파일에서 계산한 실제 값으로 모두 바꾼다. `bytes: 0`이나 예시 placeholder가 남아 있으면 validator가 실패하는 것이 정상이다.

5. 게임에서 선택 가능한 의상으로 만들 때는 별도 Ready 티켓에서 시맨틱 ID, `CHAPTER1_COSTUME_DEFINITIONS` 매핑, 사용하지 않은 해금 bit, 저장 migration과 exact-once 해금 테스트를 함께 추가한다. 기존 ID나 bit를 재사용하지 않는다.
6. 기본 전투와 기본 캠프에서는 새 이미지를 요청하지 않고, 성인 접근 확인과 캐릭터 동의 뒤 의상실을 열 때만 lazy-load되는지 확인한다.

## 검증

```powershell
npm run test:assets
npm run assets:validate
npm run test:e2e:assets
npm run verify
```

validator는 Chapter II·III 참조, 원격 runtime URL, 배포 경로 이탈, 잘못된 규격·bytes·SHA-256·권리 metadata, 중복 최종 자산을 거부한다. `src/assets/game/files` 아래의 미등록 파일도 Chapter II·III 경로라면 실패한다. Ubuntu 시각 회귀는 별도의 canonical artifact와 반복 비교가 성공해야 완료 증거가 된다.
