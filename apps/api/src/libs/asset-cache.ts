import path from 'node:path'

export const IMMUTABLE_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const REVALIDATED_ASSET_CACHE_CONTROL = 'no-cache'

export function isHashedAssetPath(filePath: string): boolean {
  return /-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(path.basename(filePath))
}

export function cacheControlForStaticFile(filePath: string): string {
  return isHashedAssetPath(filePath)
    ? IMMUTABLE_ASSET_CACHE_CONTROL
    : REVALIDATED_ASSET_CACHE_CONTROL
}
