import path from 'path'
import { defineConfig } from 'vitest/config'

// Run in the shop's time zone so date tests check what the laptop actually does
process.env.TZ = 'Asia/Beirut'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globalSetup: ['tests/helpers/global-setup.ts'],
    setupFiles: ['tests/helpers/setup-env.ts'],
    // Integration tests share one database, so files run one at a time
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
