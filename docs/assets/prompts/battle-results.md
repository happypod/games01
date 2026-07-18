# IRPG-410 battle result production record

- Mode: OpenAI built-in `image_gen`
- Use case: `stylized-concept`
- Reference images: repository-local `hero.ashen-knight.default` for Aren's identity and costume; `boss.ash-giant` or `boss.eclipse-knight` only for Emberwatch world/style cues
- Generated sources: two opaque RGB PNG files, each 1672×941
- Production export: centered 16:9 fit to 1280×720 RGB WebP, Pillow 12.2.0 Lanczos, quality 82, method 6
- Rights: project-owned generated assets; no named artist, living person, or existing franchise imitation requested
- Runtime: mounted only inside the user-opened result dialog; `fallback.result` and authoritative HTML copy remain available on load failure

## `result.boss-victory`

```text
Create a production battle-result illustration for the dark-fantasy idle RPG “Emberwatch”.

Use case: stylized-concept game result asset, boss victory.
Canvas/aspect: cinematic 16:9 landscape, intended final export 1280×720.
Reference roles: Image 1 is the exact hero identity and costume reference (Aren, the Ashen Knight: human male, dark battered plate armor, deep ember-red scarf/cape, ember-lit straight sword). Image 2 is only the visual-world and defeated ash-boss reference.

Scene: Aren is alive and standing after victory, calm and resolute, lowering his ember sword rather than attacking. Behind and below him, a defeated colossal ash-and-stone boss reads only as a collapsed silhouette and broken rocky armor—no corpse detail, no gore. A fractured circular ember halo opens into a restrained reward-gold dawn, with a few floating sparks. The hero must remain clearly readable at mobile size.

Composition: landscape result splash, main hero and victory focal mark inside the central 55% safe area; keep the outer 10% quiet for responsive cropping; broad quiet dark values, no UI panels. Create depth with the hero in the middle ground and the defeated boss shape lower in the frame. Do not crop the hero’s head or sword hand.

Style: cinematic painterly dark-fantasy concept art matching the references; charcoal #12100f, ash brown #2d211b, ember orange #d66b3d, reward gold #dda05a, restrained teal only in distant shadows; detailed but not noisy, strong silhouette, static still image.

Hard constraints: no text, no letters, no numbers, no logo, no watermark, no UI, no border, no gore, no dismemberment, no extra limbs, no modern objects.
```

## `result.defeat`

```text
Create a production battle-result illustration for the dark-fantasy idle RPG “Emberwatch”.

Use case: stylized-concept game result asset, battle defeat and safe retreat.
Canvas/aspect: cinematic 16:9 landscape, intended final export 1280×720.
Reference roles: Image 1 is the exact hero identity and costume reference (Aren, the Ashen Knight: human male, dark battered plate armor, deep ember-red scarf/cape, ember-lit straight sword). Image 2 is only a dark-fantasy threat and visual-world reference; do not copy its exact pose or make it the main subject.

Scene: Aren is alive, conscious, and kneeling defensively after a hard defeat, one gauntleted hand and his planted sword supporting him as he prepares to retreat. His armor is scuffed but intact. His ember sword and nearby fire are fading, while a restrained distant teal path/light indicates the safe return route. A large enemy presence is only a soft, distant silhouette in smoke—no attack in progress, no corpse, no gore. Mood is sober but resilient, never hopeless or “game over.”

Composition: landscape result splash, hero and planted sword inside the central 55% safe area; keep outer 10% quiet for responsive cropping; low kneeling silhouette centered slightly left, distant teal return light slightly right, broad quiet dark values, no UI panels. Do not crop the hero’s head, supporting hand, or sword.

Style: cinematic painterly dark-fantasy concept art matching the hero reference; charcoal #12100f, ash brown #2d211b, fading ember orange #d66b3d, restrained teal #68c9b4 for the return route; detailed but not noisy, strong readable silhouette at mobile size, static still image.

Hard constraints: no text, no letters, no numbers, no logo, no watermark, no UI, no border, no gore, no blood, no death, no dismemberment, no extra limbs, no modern objects.
```
