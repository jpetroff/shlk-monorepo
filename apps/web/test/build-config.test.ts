import { describe, expect, test } from 'vitest'
import { externallyConnectableMatch, extensionHostPermission, extensionIdFromOrigin } from '../vite.config'

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
