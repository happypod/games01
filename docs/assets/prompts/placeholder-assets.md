# IRPG-406 placeholder asset production record

These files are project-owned, deterministic scaffolding rather than final artwork.

- Producer: OpenAI Codex for the Emberwatch project
- Raster encoder: bundled Pillow 12.2.0, WebP lossless
- Raster construction: flat project palette, geometric silhouettes, no external source image
- Vector construction: hand-authored local SVG shapes, no script, remote reference, embedded data, or font
- Purpose: exercise asset IDs, responsive crops, fallback handling, byte budgets, and lazy loading before IRPG-407–410 final art

## Raster recipes

- `hero/ashen-knight-default.webp`: 768×768, dark ember gradient, centered knight silhouette, warm rim light.
- `enemy/ash-slime.webp`: 768×768, dark ash gradient, low rounded slime silhouette, orange core.
- `enemy/shared-enemy-placeholder.webp`: 768×768, neutral hostile silhouette used only by non-current enemy and boss placeholders.
- `region/shared-region-placeholder.webp`: 1600×900, layered volcanic ridges with a warm horizon.
- `card/shared-card-placeholder.webp`: 512×512, framed ember sigil used by equipment, skill, and event placeholders.
- `result/shared-result-placeholder.webp`: 1280×720, centered outcome seal and vignette.

All raster recipes use only locally specified colors and geometry. Re-running a recipe should preserve dimensions and visual meaning; encoded byte counts must be refreshed in `manifest.json` if the Pillow encoder changes.
