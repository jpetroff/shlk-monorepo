# MongoDB Atlas to SQLite migration and Litestream runbook

This runbook copies the production shlk database from MongoDB Atlas into the
SQLite schema already used by the application. The importer does not modify or
delete Atlas data. The final import must run while every Atlas writer is stopped.

The migration preserves Mongo document IDs, users, ban entries, shortlinks, and
unexpired login sessions. Keep APP_SESSION_SECRET unchanged through cutover or
the migrated sessions cannot authenticate existing cookies.

## Safety model

- Run the importer from a trusted host checkout with Bun 1.3.14 and normal
  development dependencies installed.
- Use an Atlas account with read access only to the shlk database.
- Supply the Atlas URI through MIGRATION_MONGO_URI. Do not put it on the command
  line, in a committed environment file, or in tickets and logs.
- Import into a new path. The importer refuses an existing SQLite file and its
  WAL, SHM, or journal sidecars.
- Invalid fields, duplicates, unknown collections, orphan owners, corrupt active
  sessions, changed source counts, and verification failures abort publication.
- Litestream is disaster-recovery replication, not multi-writer replication,
  failover, or a replacement for testing restores.
- A file replica on the live database disk does not protect against disk or host
  loss. Put LITESTREAM_REPLICA_PATH on an independently managed device when that
  protection is required.

Expected Atlas collections are users, shortlinks, banlists, and sessions.
Missing expected collections count as empty; any other non-system collection
stops the migration.

## Prepare the host

Install the pinned dependencies and create a restricted work directory:

~~~sh
bun install --frozen-lockfile
install -d -m 700 /srv/shlk-migration
~~~

Create a temporary Atlas migration account with the read role on the shlk
database. Allow the migration host through the Atlas network policy. Obtain the
SRV URI, then enter it without echoing it or storing it in shell history:

~~~sh
read -rsp 'Atlas migration URI: ' MIGRATION_MONGO_URI
printf '\n'
export MIGRATION_MONGO_URI
export MIGRATION_MONGO_DB=shlk
export MIGRATION_SQLITE_PATH=/srv/shlk-migration/shlk.sqlite
~~~

The URI must contain URL-encoded credentials when its username or password has
reserved URI characters. The importer never logs or writes this value.

## Audit and rehearse

Run a complete dry run against a recent staging copy or the read-only production
source. Dry run creates and validates a temporary SQLite database, removes it,
and leaves a redacted report beside the requested destination path:

~~~sh
bun run --cwd apps/api db:import:mongo -- --dry-run
test ! -e "$MIGRATION_SQLITE_PATH"
chmod 600 "$MIGRATION_SQLITE_PATH.migration-report.json"
~~~

Review all source counts, skipped sessions, source/destination hashes, SQLite and
Mongo versions, required indexes, integrity checks, and foreign-key checks. Only
expired sessions may be skipped. The report must have status dry-run and no
issues.

Perform two rehearsals against an isolated Atlas copy:

1. Run dry-run.
2. Run the real importer to a new disposable path.
3. Start the application against that file.
4. Compare representative GraphQL responses and public redirects.
5. Exercise login/logout, an existing authenticated session, shortlink creation,
   descriptor conflicts, search/sort/pagination, snooze timers, and bans.
6. Record import duration, source size, SQLite size, and the maintenance-window
   allowance.
7. Remove only the disposable rehearsal files after results are recorded.

The importer checks collection counts at the beginning and end, but this is not
a substitute for stopping writers during the final import.

## Configure local Litestream replication

Copy the Docker environment template and set these values:

~~~sh
SQLITE_VOLUME_NAME=shlk_sqlite-data-migration-20260817
LITESTREAM_REPLICA_PATH=/srv/shlk-litestream
SHLK_RUNTIME_UID=1000
SHLK_RUNTIME_GID=1000
LITESTREAM_PLATFORM=linux/amd64
LITESTREAM_IMAGE=litestream/litestream:0.5.15-scratch@sha256:fdd2bda105f352981be251ee39f36e7181578f4e994791dee87acf46b2f8741e
~~~

For Linux arm64 use platform linux/arm64 and this image digest:

~~~text
sha256:e5fd26f15cad0df5c99cf011583f6549f5a14c160a0930970eb0f29803dc88d4
~~~

Confirm the runtime container's Bun numeric UID and GID before changing the
defaults. Create the replica directory with matching ownership:

~~~sh
sudo install -d -m 700   -o "$SHLK_RUNTIME_UID"   -g "$SHLK_RUNTIME_GID"   "$LITESTREAM_REPLICA_PATH"
~~~

The Compose override uses docker/litestream.yml and provides:

- a restore gate that leaves an existing database untouched;
- full-integrity restore when the database is missing;
- startup failure when both the live database and replica are missing;
- a single continuous Litestream process;
- ten-second syncs, daily snapshots, and 168-hour retention;
- JSON logging, private port 9090 metrics, five-second busy timeout, and a
  bounded final shutdown sync.

Validate both Compose files before the maintenance window:

~~~sh
docker compose   --env-file .env.docker   -f compose.yaml   -f compose.litestream.yaml   config --quiet
~~~

Do not use network storage for the live SQLite volume. The application and
Litestream must share a local Docker volume on the same Linux kernel.

## Final maintenance-window import

### 1. Freeze writes

1. Enable maintenance mode or block public traffic.
2. Stop every application replica connected to Atlas.
3. Stop jobs, scripts, and administrative tools that can write Atlas.
4. Disable automatic restart of the old application.
5. Confirm no application writer remains connected.

MongoDB's TTL monitor can remove expired sessions during the window. The
importer records those sessions as source records and skips only sessions
expired at its fixed start time.

### 2. Create the rollback archive

Create an immutable final Mongo archive before importing:

~~~sh
mongodump   --uri "$MIGRATION_MONGO_URI"   --db "$MIGRATION_MONGO_DB"   --archive=/srv/shlk-migration/shlk-final.archive.gz   --gzip

chmod 600 /srv/shlk-migration/shlk-final.archive.gz
sha256sum /srv/shlk-migration/shlk-final.archive.gz   > /srv/shlk-migration/shlk-final.archive.gz.sha256
chmod 600 /srv/shlk-migration/shlk-final.archive.gz.sha256
sha256sum --check /srv/shlk-migration/shlk-final.archive.gz.sha256
~~~

A failed dump or checksum stops the cutover.

### 3. Run the importer

Ensure the destination and sidecars do not exist, then import:

~~~sh
test ! -e "$MIGRATION_SQLITE_PATH"
test ! -e "$MIGRATION_SQLITE_PATH-wal"
test ! -e "$MIGRATION_SQLITE_PATH-shm"

bun run --cwd apps/api db:import:mongo
~~~

The command succeeds only after applying checked-in Drizzle migrations,
importing in 500-row transactions, comparing canonical row hashes, checking JSON
and constraints, running SQLite integrity and foreign-key checks, optimizing and
vacuuming, checkpointing the WAL, and atomically publishing the final file.

Require all of the following:

- report status is success;
- issueCount is zero;
- source and destination hashes match for every collection;
- destination equals written for every collection;
- skipped is zero except for expired sessions;
- every check is true;
- the file mode is 0600;
- fileSha256 matches a fresh sha256sum result.

### 4. Install into a fresh named volume

Never copy over a database in a used volume. Create the versioned volume named in
SQLITE_VOLUME_NAME:

~~~sh
docker volume create "$SQLITE_VOLUME_NAME"
~~~

Copy the validated file with the runtime image. The source mount remains
read-only:

~~~sh
docker run --rm   --user 0:0   -e TARGET_UID="$SHLK_RUNTIME_UID"   -e TARGET_GID="$SHLK_RUNTIME_GID"   -v "$SQLITE_VOLUME_NAME:/target"   -v /srv/shlk-migration:/source:ro   --entrypoint sh   "$SHLK_IMAGE:$SHLK_IMAGE_TAG"   -c 'set -eu
      test ! -e /target/shlk.sqlite
      cp /source/shlk.sqlite /target/shlk.sqlite
      chown "$TARGET_UID:$TARGET_GID" /target/shlk.sqlite
      chmod 600 /target/shlk.sqlite'
~~~

Verify the checksum inside the volume:

~~~sh
expected="$(sha256sum "$MIGRATION_SQLITE_PATH" | awk '{print $1}')"
actual="$(docker run --rm   -v "$SQLITE_VOLUME_NAME:/data:ro"   --entrypoint sha256sum   "$SHLK_IMAGE:$SHLK_IMAGE_TAG"   /data/shlk.sqlite | awk '{print $1}')"
test "$actual" = "$expected"
~~~

### 5. Seed and test Litestream

Force the initial snapshot before opening traffic:

~~~sh
docker compose   --env-file .env.docker   -f compose.yaml   -f compose.litestream.yaml   run --rm litestream replicate -once -force-snapshot
~~~

Restore the replica to a new disposable path; never restore over a live database:

~~~sh
sudo install -d -m 700   -o "$SHLK_RUNTIME_UID"   -g "$SHLK_RUNTIME_GID"   /srv/shlk-restore-test

docker run --rm   --user "$SHLK_RUNTIME_UID:$SHLK_RUNTIME_GID"   -v "$LITESTREAM_REPLICA_PATH:/backup:ro"   -v /srv/shlk-restore-test:/restore   "$LITESTREAM_IMAGE"   restore -integrity-check full   -o /restore/shlk.sqlite   file:///backup/shlk
~~~

Open the restored file with Bun and require both SQLite checks to pass:

~~~sh
SQLITE_PATH=/srv/shlk-restore-test/shlk.sqlite   bun run --cwd apps/api db:migrate

bun -e '
  import { Database } from "bun:sqlite"
  const db = new Database("/srv/shlk-restore-test/shlk.sqlite", { strict: true })
  const integrity = db.query("PRAGMA integrity_check").values()
  const foreignKeys = db.query("PRAGMA foreign_key_check").values()
  if (JSON.stringify(integrity) !== JSON.stringify([["ok"]]) || foreignKeys.length) {
    throw new Error("restored database verification failed")
  }
  db.close()
'
~~~

Compare table counts and canonical hashes with the migration report. Keep the
restore drill output until the cutover is approved.

### 6. Start and verify

Start the full topology:

~~~sh
docker compose   --env-file .env.docker   -f compose.yaml   -f compose.litestream.yaml   up --detach --no-build

docker compose   --env-file .env.docker   -f compose.yaml   -f compose.litestream.yaml   ps

docker compose   --env-file .env.docker   -f compose.yaml   -f compose.litestream.yaml   logs --tail=200 sqlite-restore litestream app
~~~

The restore gate must complete successfully, Litestream must report a successful
sync, and the app must pass migrations and foreign_key_check before listening.
Run internal smoke tests while traffic is still blocked, including an existing
session. Reopen traffic only after an explicit go decision.

Monitor application errors and latency, SQLITE_BUSY errors, WAL and disk growth,
Litestream sync errors, replica disk free space, and the private metrics endpoint.

## Automatic restore after local database loss

Stop the app and Litestream before manipulating storage. Select a new empty
SQLITE_VOLUME_NAME and start the stack with the same replica path. The restore
gate restores /var/lib/shlk/shlk.sqlite before either the replicator or app
starts. It never uses force and will not overwrite an existing database.

If the replica has no usable backup, the restore gate fails and blocks startup.
Do not bypass it by starting the app alone because the app would create an empty
database. Restore manually to a new path, validate integrity, foreign keys,
counts, and application behavior, then install that file into a new volume.

For point-in-time recovery, preview first:

~~~sh
docker run --rm   --user "$SHLK_RUNTIME_UID:$SHLK_RUNTIME_GID"   -v "$LITESTREAM_REPLICA_PATH:/backup:ro"   -v /srv/shlk-restore-test:/restore   "$LITESTREAM_IMAGE"   restore -dry-run -json   -timestamp 2026-08-17T00:00:00Z   -o /restore/shlk-pitr.sqlite   file:///backup/shlk
~~~

Repeat without -dry-run only after reviewing the selected transaction range.
Restore to a new filename and never use -force during routine recovery.

## Rollback and decommission

Before public traffic reopens, rollback is straightforward: stop the new stack,
leave the SQLite volume intact, start the previous Mongo-backed release against
the unchanged Atlas source, and rerun smoke tests.

After SQLite accepts new writes, Atlas is stale. A rollback then requires a new
maintenance window and an explicit reconciliation/export of SQLite writes;
blindly pointing traffic back to Atlas loses post-cutover changes.

Keep the final Atlas dump, checksum, migration report, and stopped Atlas source
for the approved rollback period. Revoke the temporary Atlas account and remove
its network allowlist entry after sign-off. Do not delete Atlas, its dump, the
old volume, the imported SQLite file, or the Litestream replica as part of the
migration change itself.
