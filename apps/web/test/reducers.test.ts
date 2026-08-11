import { describe, expect, it } from 'vitest'
import { creatorReducer, type CreatorState } from '../src/apps/ShortlinkBar/use-shortlink-creator'
import {
  groupShortlinks,
  shortlinkListReducer,
  ShortlinkListContentDisplay,
  ShortlinkListSubsection
} from '../src/apps/ShortlinkList'

const creatorState: CreatorState = {
  location: 'https://example.com',
  result: null,
  userTag: 'alex',
  descriptionTag: '',
  descriptorDirty: false,
  createPhase: 'idle',
  descriptorPhase: 'idle',
  showSnoozeOptions: false,
  notice: null
}

describe('creatorReducer', () => {
  it('moves through loading, result, and descriptor phases immutably', () => {
    const loading = creatorReducer(creatorState, { type: 'create-loading' })
    expect(loading).not.toBe(creatorState)
    expect(loading.createPhase).toBe('loading')

    const result = creatorReducer(loading, { type: 'result', result: {
      location: 'https://example.com', hash: 'abc123',
      descriptor: { userTag: 'alex', descriptionTag: 'docs' }
    } })
    expect(result.createPhase).toBe('idle')
    expect(result.descriptionTag).toBe('docs')

    const edited = creatorReducer(result, { type: 'descriptor', value: 'New page!' })
    expect(edited.descriptionTag).toBe('New-page')
    expect(edited.descriptorDirty).toBe(true)
    expect(result.descriptionTag).toBe('docs')
  })

  it('clears stale output and notices when the location changes', () => {
    const previous = { ...creatorState, result: { location: creatorState.location, hash: 'hash' },
      notice: { type: 'error' as const, message: 'failed' } }
    const next = creatorReducer(previous, { type: 'location', value: ' https://next.example ' })
    expect(next.location).toBe('https://next.example')
    expect(next.result).toBeNull()
    expect(next.notice).toBeNull()
    expect(previous.result).not.toBeNull()
  })
})

describe('shortlinkListReducer', () => {
  const first = { _id: 'one', hash: '1', location: 'https://one.example', createdAt: String(Date.now()) }
  const second = { _id: 'two', hash: '2', location: 'https://two.example', createdAt: String(Date.now()) }
  const initial: Parameters<typeof shortlinkListReducer>[0] = {
    shortlinks: [first], searchQuery: '',
    contentDisplay: ShortlinkListContentDisplay.compact,
    loadMode: 'none', hasMore: true, error: null
  }

  it('replaces and appends pages without mutating the current array', () => {
    const append = shortlinkListReducer(initial, { type: 'loaded', mode: 'append', items: [second], limit: 1 })
    expect(append.shortlinks.map((item) => item._id)).toEqual(['one', 'two'])
    expect(append.shortlinks).not.toBe(initial.shortlinks)
    expect(initial.shortlinks).toHaveLength(1)

    const replace = shortlinkListReducer(append, { type: 'loaded', mode: 'replace', items: [second], limit: 30 })
    expect(replace.shortlinks).toEqual([second])
    expect(replace.hasMore).toBe(false)
  })

  it('edits and removes by stable document id', () => {
    const withBoth = { ...initial, shortlinks: [first, second] }
    const updated = { ...second, location: 'https://updated.example' }
    const edited = shortlinkListReducer(withBoth, { type: 'update', item: updated })
    expect(edited.shortlinks[0]).toBe(first)
    expect(edited.shortlinks[1]).toEqual(updated)
    expect(withBoth.shortlinks[1]).toBe(second)

    const removed = shortlinkListReducer(edited, { type: 'remove', id: 'one' })
    expect(removed.shortlinks).toEqual([updated])
  })

  it('clears a recoverable error without disturbing the list', () => {
    const failed = shortlinkListReducer(initial, { type: 'failed', message: 'Network unavailable' })
    const recovered = shortlinkListReducer(failed, { type: 'clear-error' })
    expect(recovered.error).toBeNull()
    expect(recovered.shortlinks).toBe(initial.shortlinks)
  })
})

it('groups cloned records and keeps server documents immutable', () => {
  const createdAt = new Date().toISOString()
  const item: ShortlinkDocument = { _id: 'one', hash: '1', location: 'https://one.example', createdAt }
  const rows = groupShortlinks([item], ShortlinkListSubsection.all)
  expect(rows[0].isSubheader).toBe(true)
  expect(rows[1]).toMatchObject({ _id: 'one', group: 'Today', timestamp: Date.parse(createdAt) })
  expect(rows[1]).not.toBe(item)
  expect(item).not.toHaveProperty('group')
})
