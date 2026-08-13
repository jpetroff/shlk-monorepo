import { describe, expect, test } from 'bun:test'
import {
  GoogleWebRiskProvider,
  ThreatCheckScheduler,
  WEB_RISK_THREAT_TYPES,
  type ThreatCheckResult,
  type ThreatProvider
} from '../src/libs/threat-check.service'

describe('Google Web Risk provider', () => {
  test('requests all configured threat types and maps an unsafe response', async () => {
    let requestedUrl: URL | undefined
    const fetchImpl = (async (input: string | URL | Request) => {
      requestedUrl = new URL(String(input))
      return Response.json({
        threat: { threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING'] }
      })
    }) as typeof fetch
    const provider = new GoogleWebRiskProvider('test-api-key', fetchImpl)

    await expect(provider.check('https://unsafe.example/path?private=value')).resolves.toEqual({
      verdict: 'unsafe',
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING']
    })
    expect(requestedUrl?.searchParams.get('uri')).toBe(
      'https://unsafe.example/path?private=value'
    )
    expect(requestedUrl?.searchParams.getAll('threatTypes')).toEqual(
      [...WEB_RISK_THREAT_TYPES]
    )
  })

  test('maps an empty lookup and HTTP errors', async () => {
    const safeProvider = new GoogleWebRiskProvider(
      'test-api-key',
      (async () => Response.json({})) as unknown as typeof fetch
    )
    const failingProvider = new GoogleWebRiskProvider(
      'test-api-key',
      (async () => new Response('', { status: 503 })) as unknown as typeof fetch
    )

    await expect(safeProvider.check('https://safe.example')).resolves.toEqual({
      verdict: 'safe'
    })
    await expect(failingProvider.check('https://unknown.example')).rejects.toThrow(
      'Web Risk returned HTTP 503'
    )
  })
})

describe('asynchronous threat-check scheduling', () => {
  test('deduplicates in-flight work and caches safe results for the configured TTL', async () => {
    let calls = 0
    let now = 0
    let release: (result: ThreatCheckResult) => void = () => {}
    const provider: ThreatProvider = {
      check: async () => {
        calls += 1
        return new Promise<ThreatCheckResult>((resolve) => { release = resolve })
      }
    }
    const scheduler = new ThreatCheckScheduler({
      provider,
      now: () => now,
      safeTtlMs: 1000,
      log: () => {}
    })

    const first = scheduler.queue('https://safe.example/path')
    const second = scheduler.queue('https://safe.example/path')
    expect(first).toBe(second)
    await Promise.resolve()
    expect(calls).toBe(1)

    release({ verdict: 'safe' })
    await first
    await scheduler.queue('https://safe.example/path')
    expect(calls).toBe(1)

    now = 1001
    const refreshed = scheduler.queue('https://safe.example/path')
    await Promise.resolve()
    expect(calls).toBe(2)
    release({ verdict: 'safe' })
    await refreshed
  })

  test('persists unsafe destinations and logs no URL query data', async () => {
    const blocked: string[] = []
    const logs: Array<{ message: string, details: Record<string, unknown> }> = []
    const scheduler = new ThreatCheckScheduler({
      provider: {
        check: async () => ({ verdict: 'unsafe', threatTypes: ['MALWARE'] })
      },
      persistUnsafe: (location) => { blocked.push(location) },
      log: (message, details) => { logs.push({ message, details }) }
    })

    await scheduler.queue('https://unsafe.example/path?secret=value')
    expect(blocked).toEqual(['https://unsafe.example/path?secret=value'])
    expect(logs).toEqual([{
      message: 'Unsafe shortlink destination blocked',
      details: { hostname: 'unsafe.example', threatTypes: ['MALWARE'] }
    }])
  })

  test('fails open, suppresses retries briefly, and retries after the unknown TTL', async () => {
    let calls = 0
    let now = 0
    const logs: Array<Record<string, unknown>> = []
    const scheduler = new ThreatCheckScheduler({
      provider: {
        check: async () => {
          calls += 1
          throw new Error('network unavailable')
        }
      },
      now: () => now,
      unknownTtlMs: 100,
      log: (_message, details) => { logs.push(details) }
    })

    await scheduler.queue('https://unknown.example/path?secret=value')
    await scheduler.queue('https://unknown.example/path?secret=value')
    expect(calls).toBe(1)
    expect(logs[0]).toEqual({
      hostname: 'unknown.example',
      errorType: 'Error'
    })

    now = 101
    await scheduler.queue('https://unknown.example/path?secret=value')
    expect(calls).toBe(2)
  })

  test('is a clean no-op when no provider is configured', async () => {
    const scheduler = new ThreatCheckScheduler()
    await expect(scheduler.queue('https://example.com')).resolves.toBeUndefined()
  })
})
