import { describe, expect, test } from 'vitest'
import { extensionHostPermission } from '../vite.config'

describe('extension manifest build configuration', () => {
  test('derives the least-privilege host permission from the backend origin', () => {
    expect(extensionHostPermission('http://localhost:8002/api')).toBe('http://localhost:8002/*')
    expect(extensionHostPermission('https://api.example.com/v1')).toBe('https://api.example.com/*')
  })

  test('rejects non-HTTP backend URLs', () => {
    expect(() => extensionHostPermission('file:///tmp/api')).toThrow('http or https')
  })
})
