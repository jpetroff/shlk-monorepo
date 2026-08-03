# Migrate SHLK from MongoDB Atlas to a running MongoDB host

This runbook moves the `shlk` database from MongoDB Atlas to an already
deployed MongoDB instance. It uses a maintenance window and
`mongodump`/`mongorestore`. It does not deploy, expose, or harden the destination
server.

The normal procedure restores into an **empty** `shlk` database. It deliberately
does not use `--drop` and must not be used to merge an Atlas dump into a database
that already contains application data.

## Scope and expected downtime

During the final migration, every process that writes to Atlas must be stopped.
Downtime lasts for the final dump, transfer, restore, validation, application
restart, and smoke tests. Run a rehearsal first to estimate that duration.

This procedure migrates:

- Documents and standard collection metadata in the `shlk` namespace.
- Standard indexes recorded by `mongodump`, including the session TTL index.

It does not migrate Atlas database users, IP access lists, backups, alerts,
networking, Atlas Search indexes, triggers, or other Atlas platform
configuration. Recreate anything applicable separately before cutover.

## Prerequisites

Before scheduling the migration, confirm all of the following:

- The destination MongoDB deployment is running, authenticated, reachable from
  the migration machine, and not reachable from untrusted networks.
- The destination `shlk` database is empty and has enough free space for the
  data, rebuilt indexes, and operational headroom.
- The destination has a non-administrative application user with the privileges
  SHLK needs. The repository's standard deployment grants `readWrite` on
  `shlk` and creates that user in the `shlk` authentication database.
- You have an administrator account that can create and remove a temporary
  restore user on the destination.
- If the destination requires TLS, its CA certificate is installed on the
  migration machine and in the backend runtime.
- You have the Atlas SRV connection string, permission to create a temporary
  database user, and permission to add the migration machine to the Atlas IP
  access list.
- The source and destination server versions or feature compatibility versions
  satisfy MongoDB's
  [restore compatibility rules](https://www.mongodb.com/docs/database-tools/mongorestore/mongorestore-behavior-access-usage/).
  Do not assume the version of the application driver determines server
  compatibility.
- The same release of MongoDB Database Tools is used for the dump and restore.
  Check both commands on the migration machine:

  ```sh
  mongodump --version
  mongorestore --version
  ```

- The normal destination backup job is configured. A successful backup must
  eventually be proven with a restore test.
- The existing `APP_SESSION_SECRET` is available. Keep it unchanged if existing
  login sessions should remain valid; rotating it logs all users out.

MongoDB documents the current command options in the
[`mongodump`](https://www.mongodb.com/docs/database-tools/mongodump/) and
[`mongorestore`](https://www.mongodb.com/docs/database-tools/mongorestore/)
references.

## Choose safe connection arguments

The examples keep passwords out of command arguments and shell history. They
pass the username separately and omit `--password`, causing the tools to prompt
for it. Do not paste passwords into a URI.

Use the Atlas SRV address without credentials:

```text
mongodb+srv://<atlas-cluster>.mongodb.net/?retryWrites=true&w=majority
```

Use one of these destination forms.

TLS-enabled destination:

```text
mongodb://<destination-host>:27017/?authSource=admin&tls=true&tlsCAFile=/absolute/path/to/mongo-ca.pem
```

Private-network destination without TLS:

```text
mongodb://<destination-private-host>:27017/?authSource=admin
```

Use the non-TLS form only when the route is confined to a trusted private
network. For a replica set, include every supplied host and the target's
`replicaSet` option. Never bypass certificate or hostname verification with
`tlsAllowInvalidCertificates` or `tlsAllowInvalidHostnames`.

In the commands below, replace:

- `<atlas-uri>` with the credential-free Atlas URI.
- `<atlas-migration-user>` with the temporary Atlas database username.
- `<destination-admin-uri>` with an administrator URI whose `authSource`
  matches the database containing that administrator.
- `<destination-admin-user>` with the destination administrator username.
- `<destination-restore-uri>` with one of the destination forms above, using
  `authSource=admin` for the temporary restore user.

## Prepare temporary migration access

### 1. Create the Atlas reader

In Atlas, open **Security > Database Access** and create a temporary SCRAM
database user:

- Username: a migration-specific name such as `shlk-migration-reader`.
- Privilege: `read` on only the `shlk` database.
- Lifetime: the shortest period covering the rehearsal and final migration.

Atlas database users are different from Atlas console users. Create this user
through the Atlas UI, CLI, or Administration API rather than through `mongosh`.

Under **Security > Network Access**, add only the migration machine's public IP
as a `/32` entry. Give the entry an expiration time when Atlas supports it. Do
not add `0.0.0.0/0`.

Test the account. The command prompts for its password:

```sh
mongosh '<atlas-uri>' \
  --username '<atlas-migration-user>' \
  --authenticationDatabase admin \
  --eval 'db.getSiblingDB("shlk").runCommand({ ping: 1 })'
```

### 2. Create the destination restore user

Connect to the destination as an administrator:

```sh
mongosh '<destination-admin-uri>' \
  --username '<destination-admin-user>'
```

At the `mongosh` prompt, create a temporary user in `admin`. Enter a newly
generated password when `passwordPrompt()` asks for it:

```javascript
use admin
db.createUser({
  user: "shlk-migration-restore",
  pwd: passwordPrompt(),
  roles: [{ role: "restore", db: "admin" }]
})
```

The built-in `restore` role supplies the privileges required by this procedure.
This runbook neither restores users and roles nor uses oplog replay.

Test the temporary account:

```sh
mongosh '<destination-restore-uri>' \
  --username 'shlk-migration-restore' \
  --eval 'db.getSiblingDB("shlk").runCommand({ ping: 1 })'
```

## Rehearse before the maintenance window

Run the complete dump and restore path before the final migration. Restore the
rehearsal archive into a disposable MongoDB instance, not into the production
destination database. A rehearsal dump taken while the application is writing
is useful for timing and compatibility checks, but it is not the final cutover
copy. Create an equivalent temporary `restore` user on that disposable instance
or use a disposable administrator account; do not reuse a production password.

Create a private working directory on encrypted storage:

```sh
mkdir -p ./mongodb-migration
chmod 700 ./mongodb-migration
```

Create the rehearsal archive:

```sh
mongodump \
  --uri '<atlas-uri>' \
  --username '<atlas-migration-user>' \
  --authenticationDatabase admin \
  --db shlk \
  --archive=./mongodb-migration/shlk-rehearsal.archive.gz \
  --gzip
```

Restore it into the disposable instance:

```sh
mongorestore \
  --uri '<disposable-destination-uri>' \
  --username '<disposable-restore-user>' \
  --archive=./mongodb-migration/shlk-rehearsal.archive.gz \
  --gzip \
  --nsInclude='shlk.*' \
  --stopOnError
```

The restore must finish with zero failed documents. Record the dump and restore
duration, archive size, restored database size, and any warnings. Validate the
rehearsal with the comparison procedure below, then remove the disposable
deployment or database according to its own teardown process.

Do not proceed until any compatibility, validation, disk-space, or performance
problem found by the rehearsal is resolved.

## Final migration

### 1. Enter maintenance mode and stop writes

At the start of the maintenance window:

1. Put the public service into maintenance mode or otherwise block user traffic.
2. Stop the SHLK backend currently connected to Atlas.
3. Stop scheduled jobs, administrative scripts, and every other Atlas writer.
4. Confirm that no old backend replica can automatically restart during the
   migration.

Do not rely on a read-only user or UI banner while an existing backend can still
write. The final archive is taken only after all writers are stopped.

### 2. Capture the final source inventory

Record collection names, exact document counts, and index definitions after the
write freeze. The command prompts for the Atlas migration-user password:

```sh
mongosh '<atlas-uri>' \
  --username '<atlas-migration-user>' \
  --authenticationDatabase admin \
  --quiet \
  --eval '
    const source = db.getSiblingDB("shlk");
    for (const name of source.getCollectionNames().sort()) {
      const indexes = source.getCollection(name).getIndexes()
        .sort((left, right) => left.name.localeCompare(right.name));
      print(EJSON.stringify({
        collection: name,
        count: source.getCollection(name).countDocuments({}),
        indexes
      }));
    }
  ' > ./mongodb-migration/source-inventory.jsonl
```

Protect the inventory:

```sh
chmod 600 ./mongodb-migration/source-inventory.jsonl
```

MongoDB's TTL monitor can remove expired session records even after application
writes stop. If the `sessions` count changes during the window, investigate and
account for expired documents rather than ignoring an unexplained mismatch.

### 3. Create and checksum the final archive

Run `mongodump` and wait for a successful exit:

```sh
mongodump \
  --uri '<atlas-uri>' \
  --username '<atlas-migration-user>' \
  --authenticationDatabase admin \
  --db shlk \
  --archive=./mongodb-migration/shlk-final.archive.gz \
  --gzip
```

Restrict access, record its size, and create a checksum:

```sh
chmod 600 ./mongodb-migration/shlk-final.archive.gz
ls -lh ./mongodb-migration/shlk-final.archive.gz
sha256sum ./mongodb-migration/shlk-final.archive.gz \
  > ./mongodb-migration/shlk-final.archive.gz.sha256
chmod 600 ./mongodb-migration/shlk-final.archive.gz.sha256
sha256sum --check ./mongodb-migration/shlk-final.archive.gz.sha256
```

The checksum must report `OK`. If the archive is transferred to another
machine, transfer the checksum file too and repeat `sha256sum --check` there
before restoring.

Keep this archive unchanged. It is the final recoverable representation of the
Atlas data at the write freeze.

### 4. Prove that the destination is empty

Run this against the destination using its administrator account:

```sh
mongosh '<destination-admin-uri>' \
  --username '<destination-admin-user>' \
  --quiet \
  --eval '
    const names = db.getSiblingDB("shlk").getCollectionNames().sort();
    print(EJSON.stringify(names));
    if (names.length !== 0) quit(2);
  '
```

The command must print `[]` and exit successfully. If it finds collections,
stop and determine why. Do not add `--drop`, delete an unknown database, or
continue with a merge.

### 5. Restore the final archive

Verify the checksum once more immediately before restoring:

```sh
sha256sum --check ./mongodb-migration/shlk-final.archive.gz.sha256
```

Restore only the `shlk` namespace:

```sh
mongorestore \
  --uri '<destination-restore-uri>' \
  --username 'shlk-migration-restore' \
  --archive=./mongodb-migration/shlk-final.archive.gz \
  --gzip \
  --nsInclude='shlk.*' \
  --stopOnError
```

The command must exit successfully and finish with zero failed documents. If it
fails or is interrupted, do not restart it over the partial data. Keep traffic
closed, remove the partially restored `shlk` data through an explicitly reviewed
destination-administration procedure, prove the database is empty again, and
restart the restore from the beginning.

### 6. Compare data and indexes

Capture the destination inventory:

```sh
mongosh '<destination-admin-uri>' \
  --username '<destination-admin-user>' \
  --quiet \
  --eval '
    const destination = db.getSiblingDB("shlk");
    for (const name of destination.getCollectionNames().sort()) {
      const indexes = destination.getCollection(name).getIndexes()
        .sort((left, right) => left.name.localeCompare(right.name));
      print(EJSON.stringify({
        collection: name,
        count: destination.getCollection(name).countDocuments({}),
        indexes
      }));
    }
  ' > ./mongodb-migration/destination-inventory.jsonl
chmod 600 ./mongodb-migration/destination-inventory.jsonl
```

Compare the inventories:

```sh
diff --unified \
  ./mongodb-migration/source-inventory.jsonl \
  ./mongodb-migration/destination-inventory.jsonl
```

An empty diff is the expected result. If server-version metadata causes a
clearly understood index-format difference, compare each index's name, key,
uniqueness, sparsity, partial filter, collation, and TTL settings explicitly.
Do not accept missing indexes or unexplained differences.

In particular, confirm that `sessions` has the same TTL index and expiration
configuration as Atlas. This index removes expired login sessions.

### 7. Switch and start the backend

Set the deployed backend's `MONGO_URI` to its non-administrative destination
application user. Do not use the temporary restore user or destination
administrator.

Typical TLS-enabled application URI:

```text
mongodb://<app-user>:<URL-encoded-password>@<destination-host>:27017/shlk?authSource=shlk&tls=true&tlsCAFile=<CA-path-inside-backend>
```

Typical trusted-private-network URI:

```text
mongodb://<app-user>:<URL-encoded-password>@<destination-private-host>:27017/shlk?authSource=shlk
```

Use the authentication database where the application user was actually
created. Percent-encode reserved characters in the username and password. Add
the target deployment's replica-set and other required connection options when
applicable.

Keep `APP_SESSION_SECRET` unchanged if current sessions should survive. Start
exactly one backend instance and inspect its startup logs for a successful
MongoDB connection before scaling it or reopening traffic.

### 8. Smoke-test while traffic remains closed

Perform all of these checks against the new backend:

1. `GET /rest/ping` returns success.
2. An existing authenticated session can be loaded, if sessions were preserved.
3. Existing users and representative short links can be read.
4. Create a uniquely named temporary short link.
5. Read and update that temporary record.
6. Delete it and confirm it is gone.
7. Check backend and MongoDB logs for authentication, index, timeout, or write
   errors.

The reversible create/update/delete test proves the application account can
write without leaving test data behind.

### 9. Reopen traffic

Only after the restore, inventory comparison, backend connection, and smoke
tests all pass:

1. Start any additional backend replicas.
2. Re-enable scheduled jobs that should now use the destination.
3. Remove maintenance mode and reopen public traffic.
4. Monitor error rate, latency, connections, disk usage, and MongoDB logs closely
   during the first hours.

Record the time at which destination writes began. That time separates the
simple rollback window from a rollback that requires data reconciliation.

## Rollback

### Before public traffic is reopened

Atlas has remained unchanged and no application writes have been accepted on
the destination. To roll back:

1. Stop the backend connected to the destination.
2. Restore its previous Atlas `MONGO_URI` and confirm the Atlas application
   account is still valid.
3. Start the backend and run the read and health checks against Atlas.
4. Reopen traffic only after those checks pass.

Preserve the failed destination and logs for diagnosis. Do not make destructive
changes until the failure is understood.

### After destination writes have begun

Do not simply point the backend back to Atlas. Atlas does not contain writes
accepted after cutover. A rollback now requires another write freeze and a
reviewed reverse-migration or reconciliation procedure. If data loss is being
accepted instead, the exact loss window must be explicitly approved before the
switch.

## Observation period and cleanup

Keep the Atlas cluster intact and prevent writes to it for seven days after a
successful cutover. This provides an investigation reference, not a live
fallback once the destination has accepted writes.

During that period:

- Confirm scheduled destination backups complete.
- Restore one backup into an isolated test deployment and validate it.
- Monitor database growth, storage headroom, slow operations, authentication
  failures, and application errors.

After validation, remove temporary access.

Delete the destination restore user by connecting as the destination
administrator:

```sh
mongosh '<destination-admin-uri>' \
  --username '<destination-admin-user>'
```

Then run:

```javascript
use admin
db.dropUser("shlk-migration-restore")
```

In Atlas:

1. Delete or confirm automatic expiration of the temporary migration reader.
2. Remove the migration machine's temporary IP access-list entry.
3. After the seven-day observation period and final approval, decommission the
   Atlas cluster according to the organization's retention and billing policy.

Retain the final archive only if it is part of the approved backup policy. It
contains production data and must remain encrypted and access-controlled. If it
is not retained, delete the archive, checksum, and inventory files according to
the storage system's secure-data-destruction procedure; ordinary deletion or
`shred` may not securely erase data on SSD or copy-on-write storage.

## Completion checklist

- [ ] All Atlas writers were stopped before the final dump.
- [ ] `mongodump` exited successfully.
- [ ] The final archive checksum reported `OK` before restore.
- [ ] The destination `shlk` database was proven empty before restore.
- [ ] `mongorestore` exited successfully with zero failed documents.
- [ ] Collection names, exact document counts, and indexes match.
- [ ] The `sessions` TTL index matches the source.
- [ ] The backend uses the non-administrative destination application user.
- [ ] Health, session, read, and reversible write smoke tests passed.
- [ ] Traffic was reopened only after validation.
- [ ] Destination backups were tested with a restore.
- [ ] Temporary users and IP access-list entries were removed.
- [ ] Atlas remained intact for the seven-day observation period.
