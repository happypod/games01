# Emberwatch visual regression font

`NotoSansKR-Visual.woff2` is a project-specific subset of the variable Noto Sans KR font from the official Google Fonts repository.

- Source: `google/fonts/ofl/notosanskr/NotoSansKR[wght].ttf`
- License: SIL Open Font License 1.1; see `OFL.txt`
- Subset tool: FontTools 4.63.0 with Brotli 1.2.0
- Recipe: `python tools/fonts/subset-visual-font.py <NotoSansKR[wght].ttf> src/assets/fonts/NotoSansKR-Visual.woff2`
- Coverage: all text present in `index.html` and `src/**/*.{css,ts,tsx}` at build time, plus the stable punctuation set declared by the script
- Rendering: variable weight 100–900, WOFF2, hinting removed to reduce platform-specific rasterization differences

The 10 MiB upstream TTF is production source material and is not deployed or checked in. Regenerate the subset whenever a visual ticket adds user-visible glyphs, then run the IRPG-506 Ubuntu baseline workflow before approving screenshot changes.
