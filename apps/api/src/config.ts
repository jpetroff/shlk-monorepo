const requiredNames = [
  'MONGO_URI',
  'APP_SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'WEB_APP_URL',
  'PUBLIC_SERVICE_URL',
  'DISPLAY_SERVICE_URL',
  'EXTENSION_ORIGIN'
] as const

export type TrustProxy = boolean | number | string

type Environment = Record<string, string | undefined>

export function parseTrustProxy(value: string | undefined): TrustProxy {
  const normalized = value?.trim()
  if (!normalized || normalized === '0' || normalized === 'false') return false
  if (normalized === 'true') return true
  if (/^[1-9][0-9]*$/.test(normalized)) return Number.parseInt(normalized, 10)
  return normalized
}

export function loadConfig(env: Environment = process.env) {
  return {
    NODE_ENV: env.NODE_ENV ?? 'development',
    PORT: Number.parseInt(env.PORT ?? '8002', 10),
    MONGO_URI: env.MONGO_URI ?? '',
    APP_SESSION_SECRET: env.APP_SESSION_SECRET ?? '',
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? '',
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ?? '',
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI ?? '',
    WEB_APP_URL: env.WEB_APP_URL ?? '',
    PUBLIC_SERVICE_URL: env.PUBLIC_SERVICE_URL ?? '',
    DISPLAY_SERVICE_URL: env.DISPLAY_SERVICE_URL ?? '',
    EXTENSION_ORIGIN: env.EXTENSION_ORIGIN ?? '',
    TRUST_PROXY: parseTrustProxy(env.TRUST_PROXY)
  } as const
}

export type AppConfig = ReturnType<typeof loadConfig>

function hasProtocol(value: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol)
  } catch {
    return false
  }
}

export const config = loadConfig()

export function validateConfig(input: AppConfig = config): AppConfig {
  const invalid: string[] = requiredNames.filter((name) => !input[name])
  if (!Number.isInteger(input.PORT) || input.PORT < 1 || input.PORT > 65_535) {
    invalid.push('PORT')
  }
  if (input.MONGO_URI && !hasProtocol(input.MONGO_URI, ['mongodb:', 'mongodb+srv:'])) {
    invalid.push('MONGO_URI')
  }
  if (input.GOOGLE_REDIRECT_URI && !hasProtocol(input.GOOGLE_REDIRECT_URI, ['http:', 'https:'])) {
    invalid.push('GOOGLE_REDIRECT_URI')
  }
  if (input.WEB_APP_URL && !hasProtocol(input.WEB_APP_URL, ['http:', 'https:'])) {
    invalid.push('WEB_APP_URL')
  }
  if (input.PUBLIC_SERVICE_URL && !hasProtocol(input.PUBLIC_SERVICE_URL, ['http:', 'https:'])) {
    invalid.push('PUBLIC_SERVICE_URL')
  }
  if (input.EXTENSION_ORIGIN && !hasProtocol(input.EXTENSION_ORIGIN, ['chrome-extension:'])) {
    invalid.push('EXTENSION_ORIGIN')
  }
  if (input.NODE_ENV === 'production') {
    if (
      input.APP_SESSION_SECRET.length < 32 ||
      input.APP_SESSION_SECRET.startsWith('replace-with')
    ) invalid.push('APP_SESSION_SECRET')
    if (input.GOOGLE_CLIENT_ID.startsWith('replace-with')) invalid.push('GOOGLE_CLIENT_ID')
    if (input.GOOGLE_CLIENT_SECRET.startsWith('replace-with')) invalid.push('GOOGLE_CLIENT_SECRET')
    if (input.EXTENSION_ORIGIN.includes('replace-with')) invalid.push('EXTENSION_ORIGIN')
    for (const name of ['GOOGLE_REDIRECT_URI', 'WEB_APP_URL', 'PUBLIC_SERVICE_URL'] as const) {
      if (input[name] && !hasProtocol(input[name], ['https:'])) invalid.push(name)
    }
  }
  const uniqueInvalid = [...new Set(invalid)]
  if (uniqueInvalid.length > 0) {
    throw new Error(`Missing or invalid environment variables: ${uniqueInvalid.join(', ')}`)
  }
  return input
}

export default config

