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

## IRPG-417 Design QA

### Comparison set

- Source: the actual saved Type 2 screen after dismissing the offline report, where two pending expedition cards covered the complete battlefield at 1112×720.
- Implementation: the same live save and viewport after the disclosure change, plus deterministic 1440×900 and 360×800 pending-event captures.
- Canonical target: keep 17 fixtures and 68 variants. The semantic delta is four default-collapsed `visual.events.tactical-overlay` images plus eight Damaged/Severe label images; ten established mobile captures are accepted only as proven 1px capture-phase normalization from the nested-scroll harness fix, with no size, content, or layout change.

### Full-view review

- Pending expedition choices now appear as a counted, above-fold action while hero, enemy, companion, HP, combat cue, status, and stage strip remain visible.
- The existing Emberwatch palette, border radius, typography, and compact pill controls are reused; no new visual asset or alternate design language is introduced.
- The 360px view keeps the 44px control inside the canvas, preserves both combatants and the 5×2 stage strip, and adds no page-level horizontal overflow.

### Focused-region review

- The disclosure remains outside the inert battlefield base, exposes `aria-expanded` and `aria-controls`, focuses the first enabled choice on open, returns to the trigger on Escape, and restores the stage heading after the final choice.
- A polite count status reports pending changes without opening the overlay or moving focus. Only an explicitly open overlay pauses VFX presentation; hidden scenes are consumed rather than replayed later.
- Eclipse Knight damage portraits now include visible `갑옷 온전`, `갑옷 균열`, or `갑옷 붕괴 직전` text in both layout types without changing HP thresholds or save state.

### Defects resolved during review

- P1 core-surface blocker: removed automatic full-canvas coverage from saved and newly arriving pending events.
- P1 semantic conflict: aligned the “automatic battle continues” copy with an active visible battlefield instead of disabling VFX for every pending event.
- P1 reader lifecycle: removed the combat-generation dependency that closed an open disclosure on every read-only lock retry.
- P1 pending transition: merged newly arrived pending IDs after a successful choice and limited automatic focus movement to initial open or genuine removed-card recovery.
- P2 discoverability: added a persistent count action and textual armor-state label so the IRPG-416 work is visible without a debug fixture.
- P2 mobile geometry: verified the control boundary at 360×800 and retained intentional clipped actor art without page-level horizontal overflow.
- Desktop geometry follow-up measured `body/html scrollWidth === clientWidth === 1280`; the apparent right-edge crop in the combined review image was screenshot presentation, not application overflow.
- Ubuntu artifact review found the visual harness itself could retain `.app-shell.scrollLeft = 47` and manufacture a -10px clipped command despite zero document overflow. Viewport-height fitting could then reset the same nested container's vertical position. Capture alignment now uses the actual scroll-container chain, restores every ancestor's horizontal offset to zero, and asserts root, target, and command geometry before capture.

### Known follow-up

- P2: the 360px `BOSS` label and expedition disclosure are intentionally compact and could use another 3–4px of breathing room in a later presentation-only ticket.
- P2: the fixed critical callout and transient `CRIT` popup duplicate emphasis on desktop, but neither obscures a command or changes the combat event contract.

### Verification

- `npm run verify`: lint, strict TypeScript, 42 Vitest files / 353 tests, manifest validator 33/33, 30 asset IDs, production build, 55/55 general Playwright, and 5/5 production cold-load tests passed.
- Ubuntu acceptance run `29720587090`: 68/68 baselines generated and 204/204 repeated comparisons passed; artifact `8452362203` has digest `sha256:c223a46f01c91537e0bf7828533a66dd45c5db9818f81c840aa53f85b69e6235`.
- Artifact comparison found zero additions or omissions, 46 byte-identical baselines, 12 intentional semantic changes, and ten same-size mobile images changed only by the reviewed 1px capture phase correction.
- Baseline commit `20c4baf`: push quality `29725622587`, PR quality `29725625067`, and visual run `29725622560` passed. Final artifact `8454287692` has digest `sha256:38fb377a654c5aad46f4bf1f430b84bf4f03b27596ca9286be0365556b1145f4`, and all 68 downloaded PNGs are byte-identical to the tracked baselines.
- Manual combined-image review covered the actual saved screen, fixed live screen, disclosure-open state, and representative desktop/mobile canonical captures; no P0/P1 visual defect remains.

final result: passed
