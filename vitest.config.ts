import { defineConfig } from 'vitest/config'

// Unit-Tests für reine Logik (ohne Browser). Browser-Tests: playwright.config.ts
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'] },
})
