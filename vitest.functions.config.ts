import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['netlify/functions/__tests__/**/*.test.ts'],
    environment: 'node',
  },
})
