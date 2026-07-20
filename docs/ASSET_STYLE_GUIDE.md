# Emberwatch visual asset contract

IRPG-406 establishes a dark-fantasy placeholder system for later production art. It fixes identity, crop, rights, and fallback behavior; it does not approve final illustrations.

## Direction

- Palette: charcoal `#12100f`, ash brown `#2d211b`, ember orange `#d66b3d`, reward gold `#dda05a`, restrained teal `#68c9b4`.
- Light: one warm ember rim or focal glow against a low-contrast cool-dark field. Avoid full-frame bloom and pure black silhouettes.
- Silhouette: hero reads upright and guarded; regular enemies read lower or asymmetrical; bosses occupy more mass but keep a clear outer contour.
- Texture: broad, quiet values behind interface text. Fine noise and particles must not carry gameplay meaning.

## Crop and export

| Use | Crop | Production format | Maximum |
|---|---:|---|---:|
| hero, enemy, boss portrait | 1:1, subject inside central 70% | 768×768 WebP | 250 KiB |
| equipment, skill, event card | 1:1, emblem inside central 64% | 512×512 WebP | 160 KiB |
| region | 16:9, horizon outside text-safe center | 1600×900 WebP | 350 KiB |
| battle result | 16:9, focal mark inside central 55% | 1280×720 WebP | 300 KiB |
| fallback | matching use | reviewed SVG/CSS | 20 KiB |

Raster illustrations ship as WebP. SVG is limited to reviewed fallback or interface vectors and may not contain scripts, event handlers, remote references, embedded data URLs, or fonts. Original production files remain outside the deployed `src/assets/game/files` tree.

## Identity and runtime rules

- UI and content refer to stable `assetId` values; they do not persist file paths or map coordinates in `GameState` or portable saves.
- The manifest is the only metadata source. Its declared dimensions and byte count must match the actual file header and file size.
- Initial combat may request only the manifest runtime, fallbacks when needed, the current hero, and the current enemy. Regions, cards, results, and events load on first use.
- A failed or missing image never blocks combat, saving, or navigation. The component retains the Korean text name and selects the matching `fallback.character`, `fallback.region`, `fallback.card`, or `fallback.result` visual.
- HP damage variants are optional presentation-only IDs derived from the current stage and valid HP ratio; base enemy definitions and saves retain the normal portrait ID. Damage remains non-explicit: dented or fractured outer armor, soot, scratches, and weakened magic are allowed, while exposed body, sexualization, blood, gore, and dismemberment are not.

## Accessibility and motion

- Meaningful images receive concise Korean alternative text from game content, not filenames. Decorative ambient layers use empty alternative text or `aria-hidden`.
- Color is never the only distinction between hero, enemy, boss, locked, victory, and defeat states.
- Essential labels remain visible at 200% zoom and 360 px width. Art crops with `object-fit: cover`; focal subjects stay within the safe areas above.
- Static assets may receive UI-only breathing, attack, hit, and floating-number transforms. Motion must honor `prefers-reduced-motion`, preserve a readable still cue, and never become the only carrier of combat meaning.

## Rights record

Every entry records author, source type, license, and conditional evidence. CC-BY requires attribution; commercial redistribution requires a repository-local proof record; generated work requires generator and prompt/recipe record. `sourceUrl` is evidence only and is never a runtime asset URL.
