import config from '../config'
import { banLocation } from './ban.queries'

export const WEB_RISK_THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE'
] as const

export type ThreatVerdict = 'safe' | 'unsafe' | 'unknown'

export interface ThreatCheckResult {
  verdict: ThreatVerdict
  threatTypes?: string[]
}

export interface ThreatProvider {
  check(location: string): Promise<ThreatCheckResult>
}

type Fetch = typeof globalThis.fetch
type Log = (message: string, details: Record<string, unknown>) => void

export class GoogleWebRiskProvider implements ThreatProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: Fetch = globalThis.fetch
  ) {}

  async check(location: string): Promise<ThreatCheckResult> {
    const endpoint = new URL('https://webrisk.googleapis.com/v1/uris:search')
    endpoint.searchParams.set('key', this.apiKey)
    endpoint.searchParams.set('uri', location)
    for (const threatType of WEB_RISK_THREAT_TYPES) {
      endpoint.searchParams.append('threatTypes', threatType)
    }

    const response = await this.fetchImpl(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000)
    })
    if (!response.ok) throw new Error(`Web Risk returned HTTP ${response.status}`)

    const body = await response.json() as {
      threat?: { threatTypes?: string[] }
    }
    const threatTypes = body.threat?.threatTypes ?? []
    return threatTypes.length > 0
      ? { verdict: 'unsafe', threatTypes }
      : { verdict: 'safe' }
  }
}

type ThreatCheckSchedulerOptions = {
  provider?: ThreatProvider
  persistUnsafe?: (location: string) => void | Promise<void>
  now?: () => number
  safeTtlMs?: number
  unknownTtlMs?: number
  log?: Log
}

export class ThreatCheckScheduler {
  private readonly cache = new Map<string, { verdict: ThreatVerdict, expiresAt: number }>()
  private readonly inFlight = new Map<string, Promise<void>>()
  private readonly provider?: ThreatProvider
  private readonly persistUnsafe: (location: string) => void | Promise<void>
  private readonly now: () => number
  private readonly safeTtlMs: number
  private readonly unknownTtlMs: number
  private readonly log: Log

  constructor(options: ThreatCheckSchedulerOptions = {}) {
    this.provider = options.provider
    this.persistUnsafe = options.persistUnsafe ?? (() => {})
    this.now = options.now ?? Date.now
    this.safeTtlMs = options.safeTtlMs ?? 24 * 60 * 60 * 1000
    this.unknownTtlMs = options.unknownTtlMs ?? 5 * 60 * 1000
    this.log = options.log ?? console.warn
  }

  queue(location: string): Promise<void> {
    if (!this.provider) return Promise.resolve()

    const cached = this.cache.get(location)
    if (cached && cached.expiresAt > this.now()) return Promise.resolve()

    const existing = this.inFlight.get(location)
    if (existing) return existing

    const task = Promise.resolve()
      .then(() => this.provider!.check(location))
      .then(async (result) => {
        if (result.verdict === 'unsafe') {
          await this.persistUnsafe(location)
          this.log('Unsafe shortlink destination blocked', {
            hostname: new URL(location).hostname,
            threatTypes: result.threatTypes ?? []
          })
        }
        this.cache.set(location, {
          verdict: result.verdict,
          expiresAt: this.now() + (
            result.verdict === 'unknown' ? this.unknownTtlMs : this.safeTtlMs
          )
        })
      })
      .catch((error: unknown) => {
        this.cache.set(location, {
          verdict: 'unknown',
          expiresAt: this.now() + this.unknownTtlMs
        })
        this.log('Shortlink threat lookup failed', {
          hostname: new URL(location).hostname,
          errorType: error instanceof Error ? error.name : 'UnknownError'
        })
      })
      .finally(() => this.inFlight.delete(location))

    this.inFlight.set(location, task)
    return task
  }
}

const provider = config.WEB_RISK_API_KEY
  ? new GoogleWebRiskProvider(config.WEB_RISK_API_KEY)
  : undefined

export const threatChecks = new ThreatCheckScheduler({
  provider,
  persistUnsafe: banLocation
})

export function scheduleThreatCheck(location: string): void {
  void threatChecks.queue(location)
}
