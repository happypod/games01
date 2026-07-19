# IRPG-412 expedition event card prompt record

## Rights and production

- Source type: generated
- Author: OpenAI image generation, directed by Codex for Emberwatch
- License: project-owned
- Generator: OpenAI built-in image generation; Pillow 12.2.0 safe-scale WebP export
- Production date: 2026-07-19
- Original PNGs remain in the Codex generated-image archive. Production exports are repository-local 512×512 opaque RGB WebP files.

The common prompt requested one original painterly semi-realistic dark-fantasy encounter emblem against a quiet charcoal field. The complete semantic silhouette stays inside the central 64% safe area and remains readable at 64px. Lighting uses one restrained ember focal glow with muted ash-brown, reward-gold, and teal accents. Every prompt prohibited UI frames, text, letters, numbers, runes, sigils, logos, watermarks, currency symbols, rank, lock, MAX, recognizable religious or cultural marks, named-artist imitation, existing-franchise motifs, and literal reward-choice icons. Choice effects and interaction states remain HTML/CSS only.

Production export uses `tools/assets/export-card.py`: Pillow 12.2.0 Lanczos scaling, a soft deterministic edge feather onto a charcoal `#12100f` 512×512 RGB canvas, WebP quality 84 and method 6. Each source is safely scaled independently so the complete focal silhouette remains away from crop edges and no inner source boundary survives the feather.

## `event.ember-shrine`

Prompt direction: a culture-neutral ember shrine made from three soot-black basalt standing stones forming a tall open U-shaped sanctuary around one shallow bronze ember bowl. The broad stepped base and small controlled flame remain subordinate to the open stone silhouette; no chapel, carving, rune, circular seal, treasure, humanoid, or oversized fire.

- Original: `exec-d9068707-8472-41bf-b088-11664f350ddb.png`
- Safe scale: 0.68
- Export: 512×512 opaque RGB WebP, quality 84, method 6, 5,832 bytes
- Production SHA-256: `2336c1115c8242c25e79a19a1626810238dcfaf123f20e1bdaa2ba761eaad0f7`

## `event.wandering-smith`

Prompt direction: one compact travel-worn portable anvil with a broad horn and one heavy smithing hammer resting diagonally across it. The low horizontal anvil silhouette dominates, with only a tiny forge-coal glow and restrained sparks; no character, hand, armor, sword, shop sign, coin, standalone weapon pose, or circular impact disc.

- Original: `exec-f3545c09-ef46-48f4-a163-90ff8192b467.png`
- Safe scale: 0.70
- Export: 512×512 opaque RGB WebP, quality 84, method 6, 6,376 bytes
- Production SHA-256: `205a2af5f9c22bf6bb066f0153ad2262f832b24f2981397df5bdb732a2b5f429`

## `event.ash-camp`

Prompt direction: one abandoned low A-frame lean-to made from worn ash-brown cloth, with a rolled supply blanket and a small dying coal bed at the entrance. The broad triangular shelter has an open dark center and restrained teal dusk haze; no person, stone shrine, anvil, weapon, armor-like solid triangle, large bonfire, banner, or crest.

- Original: `exec-5c67725a-e48a-4aa1-a0e8-011240d6d36f.png`
- Safe scale: 0.68
- Export: 512×512 opaque RGB WebP, quality 84, method 6, 6,576 bytes
- Production SHA-256: `2d9ebfc35ea38b425f2dc434a9a70840af8b5fc743606b41921b070f777aa7ea`

## Art review checklist

- Three unique source paths and SHA-256 values; 512×512 and at most 160 KiB each.
- Distinct grayscale silhouettes at 64px: tall open shrine, low anvil with diagonal hammer, and low open A-frame camp.
- Complete focal shapes remain inside the central 64% safe area; sparse ambient glow carries no event meaning.
- No readable text, text-like rune, logo, watermark, UI state, currency mark, or recognizable religious or franchise symbol.
- Corrupt or unavailable WebP resolves to `fallback.card` while the Korean event name, choices, and engine command remain available.
