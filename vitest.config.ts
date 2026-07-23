import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  test: {
    globals: true,
    setupFiles: [],
    testTimeout: 15000,
    exclude: ['node_modules', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/core/**', 'src/shared/**', 'src/cli/**'],
      exclude: ['**/__tests__/**', '**/node_modules/**', '**/out/**'],
    },
  },
})
