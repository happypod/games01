# IRPG-416 월식의 기사 전투 손상 상태 생성 기록

## 공통 생성·권리 정보

- 생성일: 2026-07-20
- 생성 도구: OpenAI built-in image generation
- 디렉션: OpenAI Codex for Emberwatch
- 권리: project-owned
- 용도: 월식의 기사 HP 단계별 비노출 전투 손상 초상
- 안전 계약: 성인 캐릭터의 얼굴과 신체는 모든 단계에서 온전한 내부 장갑과 천으로 완전히 가린다. 노출, 선정성, 성적 자세, 유혈, 고어, 절단은 허용하지 않는다.
- 후처리: Pillow 12.2.0 RGB 768×768 LANCZOS resize, WebP quality 88, method 6

## `boss.eclipse-knight.damaged`

- 입력 자산: `src/assets/game/files/enemy/eclipse-knight.webp`
- 출력 자산: `src/assets/game/files/enemy/eclipse-knight-damaged.webp`
- SHA-256: `566958294d0534c075193009a4c5b90dfce3928e2e3e93c7cff3366ab397abc6`

```text
Edit the provided square dark-fantasy boss portrait into the MID-DAMAGE (30% to under 70% HP) state for the same fully armored adult Eclipse Knight. Preserve the original image's exact camera distance, full-body pose, silhouette, weapon position, black eclipse ring size and position, floor line, square framing, subject scale, and top/bottom/side margins. Make the damage unmistakable even when the portrait is displayed small: both crescent shoulder pauldrons have visibly chipped outer tips and broken engraved edges, the central breastplate has several bright ember-orange cracks radiating around but not obscuring the circular chest emblem, and the lower armored skirt has two clearly split metal edges. Keep the helmet closed and the body completely covered by armor and cloth; no exposed skin, nudity, sexualization, blood, wounds, gore, or dismemberment. Do not change pose, anatomy, background layout, palette, lighting direction, or weapon. High-detail realistic game illustration, readable damage silhouette, dark charcoal and bronze with restrained orange ember cracks.
```

## `boss.eclipse-knight.severe`

- 입력 자산: 위 damaged 단계의 생성 원본 PNG
- 출력 자산: `src/assets/game/files/enemy/eclipse-knight-severe.webp`
- SHA-256: `7a7ff1630b7f3059fee2137b118776eb330a19bd15ecf69b2d0bada9cde688fe`

```text
Edit this exact square MID-DAMAGE Eclipse Knight portrait into the SEVERE-DAMAGE (under 30% HP) state of the same fully armored adult character. Treat the supplied image as a locked composition: preserve pixel-consistent camera distance, full-body pose, anatomy, helmet and weapon position, black eclipse ring size and position, floor line, square framing, subject scale, and every outer margin. Increase only the non-graphic armor damage so the escalation is obvious at small UI size: enlarge the already chipped gaps along both shoulder pauldrons, add several missing outer metal plates while leaving intact dark under-armor covering every part of the body, deepen and brighten the ember-orange cracks across breastplate, gauntlets and armored skirt, split two more skirt plate edges, and add a restrained orange ember glow behind the existing silhouette. Keep the helmet closed and body completely covered; no exposed skin, nudity, sexualization, blood, wounds, gore, severed parts, or helpless sexual pose. Do not zoom, crop, move the character, change the weapon, change the eclipse, or alter the lighting direction. High-detail realistic dark-fantasy game illustration, charcoal black and bronze, clearly more damaged than input.
```
