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

export const config = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number.parseInt(process.env.PORT ?? '8002', 10),
  MONGO_URI: process.env.MONGO_URI ?? '',
  APP_SESSION_SECRET: process.env.APP_SESSION_SECRET ?? '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ?? '',
  WEB_APP_URL: process.env.WEB_APP_URL ?? '',
  PUBLIC_SERVICE_URL: process.env.PUBLIC_SERVICE_URL ?? '',
  DISPLAY_SERVICE_URL: process.env.DISPLAY_SERVICE_URL ?? '',
  EXTENSION_ORIGIN: process.env.EXTENSION_ORIGIN ?? ''
} as const

export function validateConfig(): typeof config {
  const missing: string[] = requiredNames.filter((name) => !config[name])
  if (!Number.isInteger(config.PORT) || config.PORT < 1 || config.PORT > 65_535) {
    missing.push('PORT')
  }
  if (missing.length > 0) {
    throw new Error(`Missing or invalid environment variables: ${missing.join(', ')}`)
  }
  return config
}

export default config

