import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { build, defineConfig, loadEnv, type Plugin } from 'vite'
import svgr from 'vite-plugin-svgr'

export type ExtensionBrowser = 'chrome' | 'firefox'

export function extensionBrowser(value = 'chrome'): ExtensionBrowser {
  if (value !== 'chrome' && value !== 'firefox') throw new Error('SHLK_EXTENSION_BROWSER must be chrome or firefox')
  return value
}

export function extensionBuildDirectory(browser: ExtensionBrowser): string {
  return browser === 'firefox' ? 'dist/extension-firefox' : 'dist/extension'
}

export function extensionHostPermission(backendUrl: string, browser: ExtensionBrowser = 'chrome'): string {
  const url = new URL(backendUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('VITE_BACKEND_URL must use http or https')
  }
  return `${browser === 'firefox' ? `${url.protocol}//${url.hostname}` : url.origin}/*`
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

export function createExtensionManifest(backendUrl: string, webAppUrl: string, browser: ExtensionBrowser) {
  const manifest = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'src/manifest.json'), 'utf8')
  ) as Record<string, any>
  manifest.host_permissions = [extensionHostPermission(backendUrl, browser)]
  if (browser === 'firefox') {
    // Firefox reserves Chrome's Ctrl+Shift+S default for screenshots.
    manifest.commands._execute_action.suggested_key = { default: 'Alt+Shift+S' }
    manifest.background = { scripts: ['js/background.js'], type: 'module' }
    manifest.browser_specific_settings = {
      gecko: {
        id: 'shlk@shlk.cc',
        strict_min_version: '140.0',
        data_collection_permissions: {
          required: ['personallyIdentifyingInfo', 'authenticationInfo', 'browsingActivity', 'websiteContent']
        }
      }
    }
    // Match patterns cannot restrict ports in Firefox. The bridge additionally
    // checks the exact WEB_APP_URL origin (including its port) at runtime.
    externallyConnectableMatch(webAppUrl)
    manifest.content_scripts = [{
      matches: [extensionHostPermission(webAppUrl, 'firefox')],
      js: ['js/website-content-script.js'],
      run_at: 'document_start',
      all_frames: false
    }]
  } else {
    manifest.background = { service_worker: 'js/background.js', type: 'module' }
    manifest.externally_connectable = { matches: [externallyConnectableMatch(webAppUrl)] }
  }
  return manifest
}

export async function buildWebsiteContentScript(webAppOrigin: string) {
  const result = await build({
    configFile: false,
    root: import.meta.dirname,
    envDir: false,
    publicDir: false,
    logLevel: 'silent',
    define: { __SHLK_WEB_APP_ORIGIN__: JSON.stringify(webAppOrigin) },
    build: {
      write: false,
      target: 'firefox140',
      lib: {
        entry: resolve(import.meta.dirname, 'src/js/website-content-script.ts'),
        name: 'ShlkWebsiteBridge',
        formats: ['iife'],
        fileName: () => 'website-content-script.js'
      }
    }
  })
  if ('on' in result) throw new Error('Unexpected content-script watcher')
  const outputs = Array.isArray(result) ? result : [result]
  const chunks = outputs.flatMap((output) => output.output).filter((chunk) => chunk.type === 'chunk')
  if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) {
    throw new Error('The website content script must be a standalone classic script')
  }
  return chunks[0]
}

function extensionManifest(backendUrl: string, webAppUrl: string, browser: ExtensionBrowser): Plugin {
  return {
    name: 'shlk-extension-manifest',
    apply: 'build',
    buildStart() {
      this.addWatchFile(resolve(import.meta.dirname, 'src/manifest.json'))
    },
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(createExtensionManifest(backendUrl, webAppUrl, browser), null, 2)}\n`
      })
      if (browser === 'firefox') {
        const chunk = await buildWebsiteContentScript(new URL(webAppUrl).origin)
        for (const id of chunk.moduleIds) this.addWatchFile(id)
        this.emitFile({ type: 'asset', fileName: 'js/website-content-script.js', source: chunk.code })
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  const extension = mode.startsWith('extension')
  const envDir = resolve(import.meta.dirname, '..', '..')
  const env = loadEnv(mode, envDir, '')
  const browser = extensionBrowser(env.SHLK_EXTENSION_BROWSER || 'chrome')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8002'
  const webAppUrl = env.WEB_APP_URL || 'http://localhost:5173'
  const extensionOrigin = env.EXTENSION_ORIGIN || 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const extensionId = extension && browser === 'firefox' ? '' : extensionIdFromOrigin(extensionOrigin)
  const webAppOrigin = externallyConnectableMatch(webAppUrl).slice(0, -2)
  return {
    envDir,
    base: extension ? './' : '/',
    plugins: [
      react(),
      svgr({ include: '**/*.svg?react' }),
      ...(extension ? [extensionManifest(backendUrl, webAppUrl, browser)] : [])
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
      outDir: extension ? extensionBuildDirectory(browser) : 'dist/web',
      ...(extension && browser === 'firefox' ? { target: 'firefox140' } : {}),
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

