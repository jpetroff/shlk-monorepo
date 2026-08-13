import { isIP } from 'node:net'
import config from '../config'
import { ExtError, normalizeURL } from './utils'

function isPrivateIPv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) return false

  const [first, second, third] = octets
  return first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
}

function isPrivateIPv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89a-f]/.test(normalized) || normalized.startsWith('ff')) return true

  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16)
    const low = Number.parseInt(mappedHex[2], 16)
    return isPrivateIPv4([
      high >> 8, high & 255, low >> 8, low & 255
    ].join('.'))
  }

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped ? isPrivateIPv4(mapped[1]) : false
}

function canonicalHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, '')
}

function configuredServiceHostnames(serviceUrls: readonly string[]): Set<string> {
  return new Set(serviceUrls.flatMap((value) => {
    if (!value) return []
    try {
      return [canonicalHostname(new URL(value).hostname)]
    } catch {
      return []
    }
  }))
}

export function assertAllowedDestination(
  location: string,
  serviceUrls: readonly string[] = [config.PUBLIC_SERVICE_URL, config.WEB_APP_URL]
): URL {
  const url = new URL(location)
  const hostname = canonicalHostname(url.hostname)
  const unwrappedHostname = hostname.replace(/^\[|\]$/g, '')
  const addressType = isIP(unwrappedHostname)

  const rejected = !['http:', 'https:'].includes(url.protocol) ||
    Boolean(url.username || url.password) ||
    hostname === 'localhost' || hostname.endsWith('.localhost') ||
    (addressType === 4 && isPrivateIPv4(unwrappedHostname)) ||
    (addressType === 6 && isPrivateIPv6(unwrappedHostname)) ||
    configuredServiceHostnames(serviceUrls).has(hostname)

  if (rejected) {
    throw new ExtError(
      'The destination must be a public HTTP or HTTPS URL',
      { code: 'INVALID_DESTINATION' }
    )
  }
  return url
}

export function normalizeAllowedDestination(
  rawLocation: string,
  serviceUrls: readonly string[] = [config.PUBLIC_SERVICE_URL, config.WEB_APP_URL]
): string {
  const input = rawLocation.trim()
  const explicitScheme = input.match(/^([a-z][a-z\d+.-]*):(.*)$/i)
  const isHostWithPort = explicitScheme?.[1].includes('.') &&
    /^\d+(?:\/|$)/.test(explicitScheme[2])

  if (
    explicitScheme &&
    !['http', 'https'].includes(explicitScheme[1].toLowerCase()) &&
    !isHostWithPort
  ) {
    throw new ExtError(
      'The destination must be a public HTTP or HTTPS URL',
      { code: 'INVALID_DESTINATION' }
    )
  }

  const location = normalizeURL(input)
  assertAllowedDestination(location, serviceUrls)
  return location
}
