import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    alias: {
      '@/components': path.resolve(__dirname, './src/components'),
      '@/shared':     path.resolve(__dirname, '../shared'),
      '@/lib':        path.resolve(__dirname, './src/lib'),
    },
  },
})
