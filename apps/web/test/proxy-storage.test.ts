import { beforeEach, expect, it } from 'vitest'
import proxyStorage from '../src/js/proxy-storage.webapp'

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('first', JSON.stringify({ value: 1 }))
  window.localStorage.setItem('second', 'plain text')
})

it('enumerates every item when keys are null or empty', async () => {
  await expect(proxyStorage.getAllItems(null)).resolves.toEqual({
    first: { value: 1 },
    second: 'plain text'
  })
  await expect(proxyStorage.getAllItems([])).resolves.toEqual({
    first: { value: 1 },
    second: 'plain text'
  })
})

it('limits enumeration to requested keys', async () => {
  await expect(proxyStorage.getAllItems(['second'])).resolves.toEqual({
    second: 'plain text'
  })
})

it('stores object and string values without changing their representation', async () => {
  await proxyStorage.setAllItems({ object: { nested: true }, string: 'value' })

  await expect(proxyStorage.getItem('object')).resolves.toEqual({ nested: true })
  await expect(proxyStorage.getItem('string')).resolves.toBe('value')
})
