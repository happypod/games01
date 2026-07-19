import { expect, test } from '@playwright/test'
import {
  VISUAL_FIXTURE_IDS,
  VISUAL_FIXTURE_REGISTRY,
  VISUAL_FIXTURE_VARIANTS,
} from '../src/debug/visualFixtures'
import {
  fitVisualCaptureTarget,
  observeBrowserErrors,
  openVisualFixture,
  verifyResponsiveVisualSurface,
} from './visualHarness'

test.describe.configure({ mode: 'serial', timeout: 60_000 })

for (const fixtureId of VISUAL_FIXTURE_IDS) {
  const fixture = VISUAL_FIXTURE_REGISTRY[fixtureId]
  for (const variant of VISUAL_FIXTURE_VARIANTS) {
    test(`${fixture.id} · ${variant.id}`, async ({ context, page }, testInfo) => {
      const browserErrors = observeBrowserErrors(page)
      const target = await openVisualFixture(context, page, fixture, variant, testInfo)

      await verifyResponsiveVisualSurface(page, target, variant)
      await fitVisualCaptureTarget(page, target)
      await expect(target).toHaveScreenshot(
        `${fixture.id.replaceAll('.', '-')}-${variant.id}.png`,
      )
      expect(browserErrors).toEqual({ console: [], page: [] })
    })
  }
}
