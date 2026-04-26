import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` is a runtime guard that Next.js resolves at build time;
      // under vitest we stub it out so server-only modules can be imported.
      'server-only': path.resolve(__dirname, './vitest.server-only-stub.ts'),
    },
  },
})
