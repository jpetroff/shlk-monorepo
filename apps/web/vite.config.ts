import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import svgr from 'vite-plugin-svgr'

export function extensionHostPermission(backendUrl: string): string {
  const url = new URL(backendUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('VITE_BACKEND_URL must use http or https')
  }
  return `${url.origin}/*`
}

function extensionManifest(backendUrl: string): Plugin {
  return {
    name: 'shlk-extension-manifest',
    apply: 'build',
    generateBundle() {
      const manifest = JSON.parse(
        readFileSync(resolve(import.meta.dirname, 'src/manifest.json'), 'utf8')
      ) as { host_permissions?: string[] }
      manifest.host_permissions = [extensionHostPermission(backendUrl)]
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(manifest, null, 2)}\n`
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const extension = mode.startsWith('extension')
  const envDir = resolve(import.meta.dirname, '..', '..')
  const env = loadEnv(mode, envDir, '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8002'
  return {
    envDir,
    base: extension ? './' : '/',
    plugins: [
      react(),
      svgr({ include: '**/*.svg?react' }),
      ...(extension ? [extensionManifest(backendUrl)] : [])
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

