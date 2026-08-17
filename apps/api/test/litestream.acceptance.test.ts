import { Database } from 'bun:sqlite'
import { afterEach, expect, test } from 'bun:test'
import {
  existsSync,
  mkdtempSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const litestreamBinary = process.env.LITESTREAM_BIN
const acceptanceTest = litestreamBinary ? test : test.skip
const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

async function run(arguments_: string[]) {
  const process_ = Bun.spawn([litestreamBinary!, ...arguments_], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    process_.exited,
    new Response(process_.stdout).text(),
    new Response(process_.stderr).text()
  ])
  return { exitCode, stdout, stderr }
}

acceptanceTest('replicates, final-syncs, restores, and refuses destructive recovery', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'shlk-litestream-'))
  temporaryDirectories.push(directory)
  const databasePath = join(directory, 'live.sqlite')
  const replicaPath = join(directory, 'replica')
  const restorePath = join(directory, 'restored.sqlite')
  const missingReplicaPath = join(directory, 'missing-replica')

  const database = new Database(databasePath, { create: true, strict: true })
  database.query('PRAGMA journal_mode = WAL').get()
  database.exec('CREATE TABLE events (id INTEGER PRIMARY KEY, value TEXT NOT NULL)')
  database.query('INSERT INTO events (value) VALUES (?)').run('before-snapshot')

  const snapshot = await run([
    'replicate',
    '-once',
    '-force-snapshot',
    databasePath,
    'file://' + replicaPath
  ])
  expect(snapshot.exitCode).toBe(0)

  const daemon = Bun.spawn([
    litestreamBinary!,
    'replicate',
    databasePath,
    'file://' + replicaPath
  ], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  await Bun.sleep(500)
  database.query('INSERT INTO events (value) VALUES (?)').run('before-shutdown')
  await Bun.sleep(1200)
  daemon.kill('SIGTERM')
  expect(await daemon.exited).toBe(0)
  database.close(false)

  const dryRun = await run([
    'restore',
    '-dry-run',
    '-json',
    '-o',
    restorePath,
    'file://' + replicaPath
  ])
  expect(dryRun.exitCode).toBe(0)
  expect(JSON.parse(dryRun.stdout)).toHaveProperty('target_path', restorePath)
  expect(existsSync(restorePath)).toBe(false)

  const restore = await run([
    'restore',
    '-integrity-check',
    'full',
    '-o',
    restorePath,
    'file://' + replicaPath
  ])
  expect(restore.exitCode).toBe(0)

  const restored = new Database(restorePath, { readonly: true, strict: true })
  expect(restored.query('SELECT value FROM events ORDER BY id').values()).toEqual([
    ['before-snapshot'],
    ['before-shutdown']
  ])
  expect(restored.query('PRAGMA integrity_check').values()).toEqual([['ok']])
  restored.close()

  const overwrite = await run([
    'restore',
    '-o',
    restorePath,
    'file://' + replicaPath
  ])
  expect(overwrite.exitCode).not.toBe(0)
  expect(overwrite.stderr).toContain('already exists')

  const missing = await run([
    'restore',
    '-if-db-not-exists',
    '-o',
    join(directory, 'missing.sqlite'),
    'file://' + missingReplicaPath
  ])
  expect(missing.exitCode).not.toBe(0)
}, 30_000)
