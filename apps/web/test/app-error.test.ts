import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppError, { toAppError } from '../src/js/app-error'
import GQLRequest from '../src/js/request-wrapper.gql'

describe('AppError', () => {
  it('normalizes legacy object and array errors without losing their message or code', () => {
    const objectError = toAppError({ message: 'GraphQL failed', code: 'BAD_INPUT' })
    const arrayError = toAppError([{ message: 'Legacy GraphQL failed', code: 409 }])

    expect(objectError).toBeInstanceOf(AppError)
    expect(objectError).toMatchObject({ message: 'GraphQL failed', code: 'BAD_INPUT' })
    expect(arrayError).toBeInstanceOf(AppError)
    expect(arrayError).toMatchObject({ message: 'Legacy GraphQL failed', code: '409' })
  })

  it('uses a safe fallback for arbitrary thrown values', () => {
    expect(toAppError(null, 'Please try later')).toMatchObject({ message: 'Please try later' })
  })
})

describe('GQLRequest', () => {
  const fetchMock = vi.fn()
  const request = new GQLRequest({ baseURL: '/api', method: 'POST', headers: { 'X-Client': 'web' } })

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts JSON with credentials and returns GraphQL data', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    const controller = new AbortController()

    await expect(request.request('query Test { ok }', { id: 'one' }, {
      signal: controller.signal
    })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'web'
      },
      body: JSON.stringify({ query: 'query Test { ok }', variables: { id: 'one' } })
    }))
  })

  it.each([200, 409])('throws GraphQL errors returned with HTTP %s', async (status) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      errors: [{ message: 'Descriptor already exists', extensions: { code: 'CONFLICT' } }]
    }), { status }))

    await expect(request.request('mutation Test')).rejects.toMatchObject({
      name: 'AppError',
      message: 'Descriptor already exists',
      code: 'CONFLICT'
    })
  })

  it('normalizes non-GraphQL HTTP and malformed responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Unavailable' }), { status: 503 }))
    await expect(request.request('query Test')).rejects.toMatchObject({
      name: 'AppError',
      code: 'HTTP_503'
    })

    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }))
    await expect(request.request('query Test')).rejects.toMatchObject({
      name: 'AppError',
      code: 'INVALID_RESPONSE'
    })
  })

  it('normalizes network failures but preserves abort errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network unavailable'))
    await expect(request.request('query Test')).rejects.toMatchObject({
      name: 'AppError',
      message: 'Network unavailable'
    })

    const abortError = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValueOnce(abortError)
    await expect(request.request('query Test')).rejects.toBe(abortError)
  })
})
