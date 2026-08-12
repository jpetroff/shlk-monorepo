import { describe, expect, test } from 'bun:test'
import {
  cacheControlForStaticFile,
  IMMUTABLE_ASSET_CACHE_CONTROL,
  isHashedAssetPath,
  REVALIDATED_ASSET_CACHE_CONTROL
} from '../src/libs/asset-cache'

describe('production asset caching', () => {
  test.each([
    '/public/assets/index-C9x2XEAY.js',
    '/public/assets/index-DT5WWEkU.css',
    '/public/assets/PPMori-SemiBold-CzGfX5Qy.woff2',
    '/public/assets/shlk_logo-CBlL9CFd.jpg',
    '/public/assets/shlk_logo-DlgZ9054.mp4',
    '/public/assets/app-main-DMwWj_-8.css'
  ])('recognizes a Vite hash before the extension: %s', (filePath) => {
    expect(isHashedAssetPath(filePath)).toBe(true)
    expect(cacheControlForStaticFile(filePath)).toBe(IMMUTABLE_ASSET_CACHE_CONTROL)
  })

  test.each([
    '/public/index.html',
    '/public/favicon.ico',
    '/public/favicon.svg',
    '/public/manifest.json',
    '/public/robots.txt',
    '/public/assets/index.js',
    '/public/assets/index-short.js',
    '/public/assets/index-C9x2XEAY.js.map'
  ])('keeps stable or unhashed assets revalidated: %s', (filePath) => {
    expect(isHashedAssetPath(filePath)).toBe(false)
    expect(cacheControlForStaticFile(filePath)).toBe(REVALIDATED_ASSET_CACHE_CONTROL)
  })

  test('requires at least eight hash characters', () => {
    expect(isHashedAssetPath('/assets/index-1234567.js')).toBe(false)
    expect(isHashedAssetPath('/assets/index-12345678.js')).toBe(true)
  })
})
