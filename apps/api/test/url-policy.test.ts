import { describe, expect, test } from 'bun:test'
import {
  assertAllowedDestination,
  normalizeAllowedDestination
} from '../src/libs/url-policy'
import { normalizeURL } from '../src/libs/utils'

const serviceUrls = [
  'https://shlk.cc',
  'https://shlk.cc/app'
]

describe('shortlink destination policy', () => {
  test('accepts public HTTP and HTTPS destinations', () => {
    expect(assertAllowedDestination('https://example.com/path', serviceUrls).href).toBe(
      'https://example.com/path'
    )
    expect(assertAllowedDestination('http://8.8.8.8/path', serviceUrls).href).toBe(
      'http://8.8.8.8/path'
    )
    expect(normalizeURL('HTTP://EXAMPLE.COM/path')).toBe('http://example.com/path')
    expect(normalizeAllowedDestination('example.com:8080/path', serviceUrls)).toBe(
      'https://example.com:8080/path'
    )
  })

  test.each([
    'ftp://example.com/file',
    'https://user:password@example.com',
    'http://localhost/path',
    'http://service.localhost/path',
    'http://localhost./path',
    'http://127.0.0.1/path',
    'http://2130706433/path',
    'http://10.0.0.1/path',
    'http://169.254.169.254/latest/meta-data',
    'http://172.16.0.1/path',
    'http://192.168.0.1/path',
    'http://[::1]/path',
    'http://[fc00::1]/path',
    'http://[fe80::1]/path',
    'http://[::ffff:127.0.0.1]/path',
    'https://shlk.cc/other-shortlink',
    'https://shlk.cc./other-shortlink'
  ])('rejects non-public or self-referential destination: %s', (location) => {
    expect(() => assertAllowedDestination(location, serviceUrls)).toThrow(
      'The destination must be a public HTTP or HTTPS URL'
    )
  })

  test('returns a stable application error code', () => {
    try {
      assertAllowedDestination('http://127.0.0.1', serviceUrls)
      throw new Error('Expected destination rejection')
    } catch (error) {
      expect(error).toHaveProperty('meta.code', 'INVALID_DESTINATION')
    }
  })

  test('rejects explicit non-HTTP schemes before normalization', () => {
    expect(() => normalizeAllowedDestination('ftp://example.com/file', serviceUrls)).toThrow(
      'The destination must be a public HTTP or HTTPS URL'
    )
  })
})
