import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [
    react(),
    svgr({ include: '**/*.svg?react' })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: true,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      reporter: ['text', 'html']
    }
  }
})
