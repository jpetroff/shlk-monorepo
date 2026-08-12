import { beforeEach, expect, it, vi } from 'vitest'
import { CacheMode, ShortlinkCache } from '../src/js/cache'

const mocks = vi.hoisted(() => ({
  getAllItems: vi.fn(),
  removeItem: vi.fn(),
  getUserShortlinks: vi.fn()
}))

vi.mock('../src/js/proxy-storage.webapp', () => ({
  default: {
    getAllItems: mocks.getAllItems,
    removeItem: mocks.removeItem,
    canUse: () => true
  }
}))

vi.mock('../src/js/shortlink.gql', () => ({
  default: { getUserShortlinks: mocks.getUserShortlinks }
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getAllItems.mockResolvedValue({})
  mocks.getUserShortlinks.mockResolvedValue([])
})

async function createCache() {
  const cache = new ShortlinkCache()
  await Promise.resolve()
  vi.clearAllMocks()
  return cache
}

it('does not let an obsolete local load overwrite authenticated remote history', async () => {
  const cache = await createCache()
  let resolveLocal!: (value: AnyObject) => void
  mocks.getAllItems.mockReturnValue(new Promise((resolve) => { resolveLocal = resolve }))

  const localLoad = cache.setStorage()
  cache.setMode(CacheMode.remote)
  mocks.getUserShortlinks.mockResolvedValue([{
    location: 'https://remote.example',
    hash: 'remote',
    createdAt: '2026-08-12T00:00:00.000Z'
  }])
  await cache.setStorage()

  resolveLocal({
    local: {
      location: 'https://local.example',
      hash: 'local',
      createdAt: '2026-08-11T00:00:00.000Z'
    }
  })
  await localLoad

  expect(cache.getStorage()).toEqual([expect.objectContaining({ hash: 'remote' })])
})

it('matches cached links and keeps native local ordering newest-first', async () => {
  const cache = await createCache()
  mocks.getAllItems.mockResolvedValue({
    older: { location: 'https://older.example', hash: 'older', createdAt: '2026-08-10T00:00:00.000Z' },
    newer: { location: 'https://newer.example', hash: 'newer', createdAt: '2026-08-12T00:00:00.000Z' }
  })

  await cache.setStorage()

  expect(cache.getStorage().map((item) => item.hash)).toEqual(['newer', 'older'])
  expect(cache.checkShortlink({ location: 'https://older.example' })).toMatchObject({ hash: 'older' })
})
