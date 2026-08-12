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

export function extensionIdFromOrigin(extensionOrigin: string): string {
  const url = new URL(extensionOrigin)
  const id = url.hostname
  if (url.protocol !== 'chrome-extension:' || !/^[a-p]{32}$/.test(id)) {
    throw new Error('EXTENSION_ORIGIN must be chrome-extension:// followed by a 32-character extension ID')
  }
  return id
}

export function externallyConnectableMatch(webAppUrl: string): string {
  const url = new URL(webAppUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('WEB_APP_URL must use http or https')
  }
  return `${url.origin}/*`
}

function extensionManifest(backendUrl: string, webAppUrl: string): Plugin {
  return {
    name: 'shlk-extension-manifest',
    apply: 'build',
    generateBundle() {
      const manifest = JSON.parse(
        readFileSync(resolve(import.meta.dirname, 'src/manifest.json'), 'utf8')
      ) as { host_permissions?: string[], externally_connectable?: { matches: string[] } }
      manifest.host_permissions = [extensionHostPermission(backendUrl)]
      manifest.externally_connectable = { matches: [externallyConnectableMatch(webAppUrl)] }
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
  const webAppUrl = env.WEB_APP_URL || 'http://localhost:5173'
  const extensionOrigin = env.EXTENSION_ORIGIN || 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const extensionId = extensionIdFromOrigin(extensionOrigin)
  const webAppOrigin = externallyConnectableMatch(webAppUrl).slice(0, -2)
  return {
    envDir,
    base: extension ? './' : '/',
    plugins: [
      react(),
      svgr({ include: '**/*.svg?react' }),
      ...(extension ? [extensionManifest(backendUrl, webAppUrl)] : [])
    ],
    define: {
      __SHLK_EXTENSION_ID__: JSON.stringify(extensionId),
      __SHLK_WEB_APP_ORIGIN__: JSON.stringify(webAppOrigin)
    },
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
      assetsInlineLimit: 0,
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

