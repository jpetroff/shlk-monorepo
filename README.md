# SHLK monorepo

The SHLK website, Manifest V3 extension, and SQLite-backed API share one Bun
workspace.

The full clone-to-development, testing, extension and production guide is in
[`docs/development.md`](docs/development.md).

## Quick start

1. Install Bun 1.3.14 and Chrome/Chromium.
2. Copy `.env.example` to `.env`, add Google OAuth credentials, and replace the
   session-secret placeholder.
3. Run `bun install --frozen-lockfile`.
4. Run `bun run dev`. The API creates and migrates a clean development SQLite
   database automatically.

## Commands

- `bun run dev` starts the Bun API on port 8002 and Vite website on port 5173.
- `bun run dev:extension` starts the API and watches the unpacked extension in
  `apps/web/dist/extension`.
- `bun run lint`, `bun run typecheck`, and `bun run test` run the local checks.
- `bun run build` validates the API and builds optimized website and extension
  artifacts.
- `bun run start` runs the production API and serves `apps/web/dist/web`.
- API database commands are `db:generate`, `db:check`, and `db:migrate` in
  the `@shlk/api` workspace.

Use `bun run test`, not bare `bun test`: the web workspace uses Vitest/jsdom,
while the API uses Bun's test runner. Focused commands are `bun run test:api`
and `bun run test:web`.

## Production

The multi-stage `Dockerfile` builds a non-root API/web runtime image and a
separate `extension-artifact` ZIP target. `compose.yaml` runs one writable
application instance with a persistent local SQLite volume. It also gives the
runtime image an explicit repository and tag so the same Compose configuration
can build, publish, and deploy a release.

### Configure Docker

Create the ignored production environment file:

```sh
cp .env.docker.example .env.docker
openssl rand -hex 32
```

Edit `.env.docker`, place the generated value in `APP_SESSION_SECRET`, and
replace every `replace-with-*` placeholder. In particular:

- Set `SHLK_IMAGE` to the registry repository, such as
  `ghcr.io/acme/shlk`, and use an immutable `SHLK_IMAGE_TAG` for releases.
- Set the Google OAuth callback to `<WEB_APP_URL>/oauth/google/callback` and
  add that exact HTTPS URL to the OAuth client.
- Set `EXTENSION_ORIGIN` to the installed production extension ID.
- Leave `WEB_RISK_API_KEY` blank to disable Google Web Risk checks, or set a
  server-side API key to enable them.
- Keep `BIND_ADDRESS=127.0.0.1` when a reverse proxy on the same host terminates
  TLS. Adjust `TRUST_PROXY` only to match the actual number of trusted proxy
  hops.

Validate interpolation without printing the resolved secrets:

```sh
docker compose --env-file .env.docker config --quiet
```

The `VITE_*`, `WEB_APP_URL`, and `EXTENSION_ORIGIN` values are embedded in the
website or extension during the image build. Changing one of them requires a
new image. Runtime secrets such as `APP_SESSION_SECRET`, Google credentials,
and `WEB_RISK_API_KEY` are supplied only when the container starts.

### Build and verify locally

Run the project checks, build the exact image named in `.env.docker`, and start
it without allowing Compose to rebuild a different image:

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test

docker compose --env-file .env.docker build --pull app
docker compose --env-file .env.docker up --detach --no-build app
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail=100 app
curl --fail --show-error http://127.0.0.1:8002/rest/ping
```

Change the health-check URL if `BIND_ADDRESS` or `APP_PORT` differs. Stop the
local container with `docker compose --env-file .env.docker down`; the named
`sqlite-data` volume is retained.

### Publish a release image

Use the Git commit as an immutable tag. Shell variables override matching
values from `.env.docker`, so these commands do not require editing the file
used for local verification:

```sh
export SHLK_IMAGE=ghcr.io/replace-with-owner/shlk
export SHLK_IMAGE_TAG="$(git rev-parse --short=12 HEAD)"

docker login ghcr.io
docker compose --env-file .env.docker build --pull app
docker compose --env-file .env.docker push app
docker buildx imagetools inspect "$SHLK_IMAGE:$SHLK_IMAGE_TAG"
```

Replace `ghcr.io` with the chosen registry host. The account used by
`docker login` needs permission to push `SHLK_IMAGE`. Build on the same CPU
architecture as production; use a registry-backed Buildx workflow if multiple
architectures are required. Prefer the commit tag over `latest` so deployments
and rollbacks are reproducible.

### Deploy the published image

On the production host, copy `compose.yaml` and create its own `.env.docker`
with production secrets. Set `SHLK_IMAGE` and `SHLK_IMAGE_TAG` to the published
repository and immutable tag, authenticate to the registry, then run:

```sh
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker pull app
docker compose --env-file .env.docker up --detach --no-build --wait app
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail=100 app
curl --fail --show-error http://127.0.0.1:8002/rest/ping
```

For a rollback, restore the previous `SHLK_IMAGE_TAG`, check that its migrations
are compatible with the current database, and repeat the `pull` and `up`
commands. Do not run `docker compose down --volumes`: it removes the production
SQLite volume.

SQLite runs in WAL mode with foreign keys, a busy timeout, and full synchronous
writes. The application applies checked-in Drizzle migrations before listening.
Use only one writable application instance for a database file; backup and
Litestream replication are documented in the
[MongoDB-to-SQLite migration runbook](docs/mongodb-migration.md).

The extension ZIP is a separate build target and is not included in the runtime
image. See the [deployment guide](docs/development.md#export-the-store-extension)
for its build and validation commands.

ESLint 10 uses an isolated TypeScript 6 compiler-API tooling workspace because
TypeScript 7 does not expose the API required by `typescript-eslint`; application
compilation remains pinned to TypeScript 7.0.2.

The original repositories are intentionally not referenced by this workspace.
