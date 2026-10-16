import { describe, expect, test } from 'vitest'
import { externallyConnectableMatch, extensionHostPermission, extensionIdFromOrigin, extensionBrowser, extensionBuildDirectory, createExtensionManifest, buildWebsiteContentScript } from '../vite.config'

describe('extension manifest build configuration', () => {
  test('derives the least-privilege host permission from the backend origin', () => {
    expect(extensionHostPermission('http://localhost:8002/api')).toBe('http://localhost:8002/*')
    expect(extensionHostPermission('https://api.example.com/v1')).toBe('https://api.example.com/*')
  })

  test('rejects non-HTTP backend URLs', () => {
    expect(() => extensionHostPermission('file:///tmp/api')).toThrow('http or https')
  })

  test('derives the external website match and stable extension ID', () => {
    expect(externallyConnectableMatch('https://shlk.example/app')).toBe('https://shlk.example/*')
    expect(extensionIdFromOrigin('chrome-extension://bjkhbppdemdfngnceocjmeapcfckfkok')).toBe(
      'bjkhbppdemdfngnceocjmeapcfckfkok'
    )
  })

  test('rejects unsafe website schemes and malformed extension origins', () => {
    expect(() => externallyConnectableMatch('file:///tmp/app')).toThrow('http or https')
    expect(() => extensionIdFromOrigin('https://shlk.example')).toThrow('chrome-extension')
    expect(() => extensionIdFromOrigin('chrome-extension://too-short')).toThrow('32-character')
  })
})


describe('Firefox and Chrome build variants', () => {
  test('validates targets and keeps output directories separate', () => {
    expect(extensionBrowser()).toBe('chrome')
    expect(extensionBrowser('firefox')).toBe('firefox')
    expect(() => extensionBrowser('safari')).toThrow('chrome or firefox')
    expect(extensionBuildDirectory('chrome')).toBe('dist/extension')
    expect(extensionBuildDirectory('firefox')).toBe('dist/extension-firefox')
  })

  test.each([
    ['http://localhost:8002', 'http://localhost:5173', 'http://localhost/*'],
    ['https://api.example.com', 'https://shlk.example', 'https://api.example.com/*']
  ])('generates browser-specific manifests for %s', (backend, website, permission) => {
    const firefox = createExtensionManifest(backend, website, 'firefox')
    const chrome = createExtensionManifest(backend, website, 'chrome')
    expect(firefox.version).toBe(chrome.version)
    expect(firefox.commands._execute_action.suggested_key.default).toBe('Alt+Shift+S')
    expect(chrome.commands._execute_action.suggested_key.default).toBe('Ctrl+Shift+S')
    expect(firefox.host_permissions).toEqual([permission])
    expect(firefox.background).toEqual({ scripts: ['js/background.js'], type: 'module' })
    expect(firefox.externally_connectable).toBeUndefined()
    expect(firefox.content_scripts[0]).toMatchObject({ all_frames: false, run_at: 'document_start', js: ['js/website-content-script.js'] })
    expect(firefox.content_scripts[0].matches[0]).not.toMatch(/:\d+/)
    expect(firefox.browser_specific_settings.gecko).toMatchObject({ id: 'shlk@shlk.cc', strict_min_version: '140.0' })
    expect(firefox.browser_specific_settings.gecko.data_collection_permissions.required).not.toContain('none')
    expect(chrome.background).toEqual({ service_worker: 'js/background.js', type: 'module' })
    expect(chrome.content_scripts).toBeUndefined()
    expect(chrome.browser_specific_settings).toBeUndefined()
    expect(chrome.externally_connectable.matches).toEqual([new URL(website).origin + '/*'])
  })

  test('bundles the bridge as one classic script with the exact runtime origin', async () => {
    const chunk = await buildWebsiteContentScript('http://localhost:5173')
    expect(chunk.imports).toEqual([])
    expect(chunk.dynamicImports).toEqual([])
    expect(() => new Function(chunk.code)).not.toThrow()
    expect(chunk.code).toContain('http://localhost:5173')
  })
})
