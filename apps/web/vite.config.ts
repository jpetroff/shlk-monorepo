import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import svgr from 'vite-plugin-svgr'

function extensionManifest(): Plugin {
  return {
    name: 'shlk-extension-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: readFileSync(resolve(import.meta.dirname, 'src/manifest.json'), 'utf8')
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const extension = mode.startsWith('extension')
  return {
    envDir: resolve(import.meta.dirname, '..', '..'),
    base: extension ? './' : '/',
    plugins: [
      react(),
      svgr({ include: '**/*.svg?react' }),
      ...(extension ? [extensionManifest()] : [])
    ],
    css: {
      modules: {
        scopeBehaviour: 'global'
      }
    },
    server: {
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/api': 'http://localhost:8002',
        '/oauth': 'http://localhost:8002',
        '/logout': 'http://localhost:8002',
        '/rest': 'http://localhost:8002'
      }
    },
    build: {
      outDir: extension ? 'dist/extension' : 'dist/web',
      emptyOutDir: true,
      rollupOptions: {
        input: extension
          ? {
              index: resolve(import.meta.dirname, 'index.html'),
              background: resolve(import.meta.dirname, 'src/js/background.ts')
            }
          : resolve(import.meta.dirname, 'index.html'),
        output: {
          entryFileNames: (chunk) => chunk.name === 'background'
            ? 'js/background.js'
            : 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  }
})

