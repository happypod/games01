import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  build: {
    assetsInlineLimit: 0,
    manifest: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Full-suite jsdom startup can exceed Vitest's 5s default on constrained
    // Windows runners even though the same synchronous tests finish in ~2s
    // alone. Keep a bounded timeout while avoiding false local gate failures.
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/game/**/*.ts'],
    },
  },
})
