import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    /**
     * Явный include обязателен. По умолчанию Vitest забирает любой `*.spec.*`,
     * включая `e2e/*.spec.ts`, — а те написаны под раннер Playwright и падают
     * на сборе с «Playwright Test did not expect test() to be called here».
     * Два набора тестов запускаются разными командами: `npm test` и `npm run test:e2e`.
     */
    include: ['server/**/*.test.js'],
  },
})
