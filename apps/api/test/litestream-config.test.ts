import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const litestream = readFileSync(fileURLToPath(
  new URL('../../../docker/litestream.yml', import.meta.url)
), 'utf8')
const compose = readFileSync(fileURLToPath(
  new URL('../../../compose.litestream.yaml', import.meta.url)
), 'utf8')

describe('Litestream deployment configuration', () => {
  test('pins the release image and local replica policy', () => {
    expect(compose).toContain('litestream/litestream:0.5.15-scratch@sha256:')
    expect(compose).toContain(
      'sha256:fdd2bda105f352981be251ee39f36e7181578f4e994791dee87acf46b2f8741e'
    )
    expect(litestream).toContain('path: /backup/shlk')
    expect(litestream).toContain('sync-interval: 10s')
    expect(litestream).toContain('interval: 24h')
    expect(litestream).toContain('retention: 168h')
    expect(litestream).toContain('busy-timeout: 5s')
    expect(litestream).toContain('shutdown-sync-timeout: 30s')
  })

  test('gates startup on a non-destructive full restore', () => {
    expect(compose).toContain('sqlite-restore:')
    expect(compose).toContain('- -if-db-not-exists')
    expect(compose).toContain('- -integrity-check')
    expect(compose).toContain('- full')
    expect(compose).not.toContain('-force')
    expect(compose).not.toContain('-if-replica-exists')
    expect(compose).toContain('condition: service_completed_successfully')
    expect(compose).toContain('condition: service_started')
  })

  test('shares the live volume but separates the replica directory', () => {
    expect(compose).toContain('sqlite-data:/var/lib/shlk')
    expect(compose).toContain('source: ${LITESTREAM_REPLICA_PATH:?Set LITESTREAM_REPLICA_PATH}')
    expect(compose).toContain('target: /backup')
    expect(compose).toContain('target: /etc/litestream.yml')
  })
})
