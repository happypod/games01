# IRPG-414 Design QA

## Comparison set

- Source: the attached one-view dashboard brief and its 35% / 40% / 25% desktop wireframe, compared alongside the pre-change 1440px capture.
- Desktop implementation: `e2e/__screenshots__/irpg-506/visual-dashboard-one-view-desktop-default.png` at 1440×900.
- Mobile implementation: `e2e/__screenshots__/irpg-506/visual-dashboard-one-view-mobile-default.png` at 360×800.
- State: deterministic `visual.dashboard.one-view`, stage 10, pending expedition event, recent battle events, and actionable growth content.

## Full-view review

- Desktop keeps the existing Emberwatch type, copper/ember palette, panels, borders, focus language, and final game art while replacing linear stacking with a fixed three-column dashboard.
- Header, 35/40/25 columns, compact ten-stage strip, battle/log hierarchy, and growth/management hierarchy are aligned without document overflow at 1440×900 and 1024×768.
- Mobile preserves the original vertical reading order, shows equipment, skills, and companions as normal sections, and has no horizontal overflow at 360×800 or effective 360px at 200% zoom.

## Focused-region review

- Growth tabs: pointer, ArrowLeft/Right, Home, and End keep visible panel, `aria-selected`, and roving focus synchronized; inactive asset namespaces stay unloaded.
- Journey column: the current ten stages remain immediately visible; the full map, event cards, and results use the campaign pane's internal scroll without clipping fixture captures.
- Battle record: the collapsed panel exposes the latest five entries and expands to the existing bounded/filterable log.
- Management: prestige and save/backup remain reachable in the right pane without changing game or save state contracts.

## Defects resolved during review

- P1 fixture clipping: released dashboard height/overflow constraints for active isolated visual fixtures.
- P2 responsive semantics: removed desktop tab semantics when all growth sections are visible on mobile.
- P2 compact-map targets: switched to five 44px columns below 900px, including the 200% zoom case.
- P2 evidence gap: added 1440×900, 1024×768, and 360×800 dashboard E2E coverage for key controls and internal scrolling.

## Verification

- No page or console errors in the dashboard and canonical visual runs.
- `npm run verify`: 36 Vitest files / 297 tests, 40 browser E2E tests, and 4 production-asset E2E tests passed.
- Ubuntu canonical workflow run `29689021639`: 52/52 baselines generated and the same runner passed 156/156 over three repetitions.
- Checked-in baseline commit `0d2b9da`: push run `29689492033` and PR run `29689493495` both passed the full quality gate.
- Manual review covered the four new dashboard variants plus representative map, card, event, combat, result, and fallback baselines; no P0/P1/P2 visual defect remains.

## IRPG-415 Design QA

### Comparison set

- Source: the attached Unified Tactical Canvas brief and generated reference, reviewed beside the implementation in one comparison input.
- Type 1: the pre-existing `visual.dashboard.one-view` mobile/desktop and default/reduced baselines.
- Type 2: `visual.dashboard.tactical-canvas` and `visual.events.tactical-overlay` at 360×800 and 1440×900, each in default and reduced-motion states.

### Full-view review

- The existing Type 1 dashboard remains the default and keeps its original 35/40/25 desktop composition and mobile document flow.
- Type 2 combines region art, hero, enemy, companion, HP, stage strip, combat feedback, and the event overlay in one tactical scene without changing the game's canonical state.
- The command dock remains reachable at desktop, 360px, and effective 360px at 200% zoom; no horizontal overflow or clipped primary action remains.

### Focused-region review

- The layout selector has one active renderer and one result live region, supports pointer and keyboard selection, and restores only valid preferences.
- The tactical event overlay reuses saved choices and exact-once resolution while preserving the existing focus restoration contract.
- New VFX is bounded, non-persistent, decorative, ordered from event-time snapshots, and removed for reduced motion without removing the underlying combat information.
- The Lumi companion asset fits the measured portrait slot and uses the existing Emberwatch palette, edge treatment, and lazy asset contract.

### Defects resolved during review

- P1 legacy regression: restricted visual-fixture-only debug hiding so all 52 pre-existing baselines remain byte-identical.
- P2 200% geometry: moved companion/status layers and changed the stage strip to a 5×2 grid at narrow widths.
- P2 semantics: kept a single active result DOM/live region and restored focus after the last expedition card resolves.
- P2 evidence: added two named fixtures, eight canonical variants, cold-load checks, and layout round-trip state/hash assertions.

### Verification

- `npm run verify`: 40 Vitest files / 317 tests, 51 browser E2E tests, 5 production-asset E2E tests, manifest validator 32/32, lint, strict typecheck, and production build passed.
- Ubuntu run `29696226574`: 60/60 baselines generated and 180/180 repeated comparisons passed; artifact `8445142347` has digest `sha256:1ce9eb90f342e5c543e50736664912452f974ac6b7019a1226ceef9854c0cf62`.
- Hash comparison: all 52 existing baselines were unchanged and present; exactly eight new Type 2 baselines were added.
- Manual review of the reference comparison and final eight Ubuntu PNGs found no remaining P0/P1/P2 visual defect.

## IRPG-416 Design QA

### Comparison set

- Source: the requested motion, floating damage, ultimate flash, and HP-based damage-state brief, constrained to non-explicit fully armored presentation and reviewed beside the existing Emberwatch tactical canvas.
- Asset states: the original Eclipse Knight Normal portrait and final Damaged·Severe portraits in one comparison input with the 1440×900 implementation.
- Canonical implementation: `visual.dashboard.tactical-damaged` and `visual.dashboard.tactical-severe` at 360×800 and 1440×900, each in default and reduced-motion states.

### Full-view review

- Idle breathing, hero attack, enemy hit, companion assist, floating numbers, and the ultimate flash reinforce combat without moving commands or changing the one-view hierarchy.
- Normal, Damaged, and Severe keep the same pose, camera, eclipse ring, silhouette, and portrait margins while making armor cracks, dents, embers, and weakened aura legible at desktop and mobile sizes.
- The implementation remains fully armored, non-explicit, nonsexual, bloodless, and gore-free; existing nonsexual victory and defeat result screens are unchanged.
- The tactical scene and command dock remain usable at 1440×900, 1024×768, 360×800, and effective 360px at 200% zoom without horizontal overflow.

### Focused-region review

- Skill and critical events choose one primary popup per round, companion damage remains separate, and every popup ends inside the bounded 900ms scene.
- Kill and boss-victory snapshots do not apply the outgoing enemy's hit, defeat, or damage state to the next-stage enemy.
- Reduced motion removes breathing, lunge, shake, float, and flash animation while preserving static damage numbers and semantic combat logs.
- Damage assets remain lazy, use the existing manifest fallback geometry, and are not requested on the stage-1 production cold load.

### Defects resolved during review

- P1 event targeting: isolated kill and boss-victory presentation from the next-stage enemy snapshot.
- P2 timing: shortened delayed companion popups to retain a 120ms margin inside the scene boundary.
- P2 art direction: regenerated Damaged for stronger readability and Severe for matching camera, crop, and outer margins.
- P1 baseline preservation: removed the global debug select width change and shortened only the two new fixture labels, restoring all 60 existing canonical PNG hashes.

### Verification

- `npm run verify:code`: lint, strict TypeScript, 42 Vitest files / 342 tests, manifest validator 33/33, 30 asset IDs, and production build passed.
- Browser coverage: 54/54 general Playwright, 5/5 production cold-load, and 39/39 capture-geometry impact tests passed.
- Ubuntu run `29714484979`: 68/68 generated and 204/204 repeated comparisons passed; artifact `8450148807` proved all 60 existing PNGs unchanged and exactly eight new damage-state PNGs.
- Baseline commit `2ffbe64`: push run `29714972850`, PR run `29714975078`, and final visual run `29714972818` passed; final artifact `8450337243` has digest `sha256:4bfc12b25aae9e0116f0030e3077fc36203a2f9f7c1d2db4bb73a78e661e3602`.
- Manual combined-image review of the source states and final Ubuntu desktop/mobile captures found no remaining P0/P1/P2 visual defect.

final result: passed
