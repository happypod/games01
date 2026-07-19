# IRPG-415 — 불씨 여우 루미 초상 생성 기록

## Asset

- ID: `companion.ember-fox.default`
- Runtime path: `src/assets/game/files/companion/ember-fox-default.webp`
- Intended slot: 유형 2 통합 전술 전장의 영웅 측 동료 actor
- Final dimensions: 768×768 WebP
- Byte budget: 250 KiB 이하

## Source and rights

- Source type: generated
- Generator: OpenAI built-in `image_gen`
- Direction: Codex for Emberwatch
- License: project-owned
- Generated source retained by the Codex workspace; the checked-in WebP is the production derivative.

## Prompt

> Create one production game asset: a square 768x768 painted portrait of “Lumi, the Ember Fox”, a loyal small fox companion for the same dark-fantasy idle RPG visual style as the supplied Ashen Knight and Twilight Wolf assets. Three-quarter pose, ember-orange and soot-black fur, one subtle teal charm, alert intelligent eyes, warm rim light from embers, smoky ash battlefield background, strong readable silhouette at 128px, premium painterly concept-art finish, no text, no UI, no frame, no transparency, no logos, no watermark. Match the existing asset palette and brushwork; do not copy either character.

## References

- `src/assets/game/files/hero/ashen-knight-default.webp`
- `src/assets/game/files/enemy/twilight-wolf.webp`
- Emberwatch palette: charcoal `#12100f`, ash `#2d211b`, ember `#d66b3d`, gold `#dda05a`, teal `#68c9b4`

## Production transform

- Source was center-cropped to a square, resized to 768×768 with Lanczos, converted to RGB, and exported by Pillow 12.2.0 as WebP quality 82 / method 6.
- Final SHA-256: `a30f0c13c5d61000172acb4f58334d66e90848cd1a112f8fb940b6a318113b1a`
