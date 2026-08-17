# Development and deployment

SHLK is a Bun workspace containing an Express/SQLite API and one React/Vite
frontend that can be built either as a website or a Manifest V3 Chrome
extension.

## Prerequisites

- [Bun 1.3.14](https://bun.com/docs/installation). On macOS or Linux, install
  the pinned version with:

  ```sh
  curl -fsSL https://bun.com/install | bash -s "bun-v1.3.14"
  bun --version
  ```

- No external database service is required. The API creates and migrates a local
  SQLite database on first development startup.
- Chrome or another Chromium browser for extension development.
- A Google OAuth web client. Add
  `http://localhost:8002/oauth/google/callback` as an authorized redirect URI.
  The API deliberately requires OAuth credentials even if login is not being
  tested.
- Docker with BuildKit and Docker Compose only if using the container workflow.

## First setup after cloning

```sh
git clone <repository-url>
cd shlk-monorepo
cp .env.example .env
bun install --frozen-lockfile
```

Edit `.env` before starting the API:

1. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the local OAuth client.
2. Generate `APP_SESSION_SECRET`, for example with `openssl rand -hex 32`.
3. Keep `SQLITE_PATH=./data/shlk.sqlite` for the default local database, or choose
   another writable path.
4. Keep the documented localhost URLs for normal website development.

`.env` and `.env.*` files are ignored. Never commit credentials. Bun loads env
files before Vite, and pre-existing process variables take precedence over
mode-specific Vite files. Prefer the single ignored `.env` for local work and
explicit environment/build arguments for releases. See
[Vite env and mode behavior](https://vite.dev/guide/env-and-mode).

Start the API and website together:

```sh
bun run dev
```

- Website: <http://localhost:5173>
- API: <http://localhost:8002>
- API health: <http://localhost:8002/rest/ping>
- GraphiQL in development: <http://localhost:5173/__graphiql>

The Vite server proxies `/api`, `/oauth`, `/logout`, and `/rest` to the API.
Both processes watch their source files.

### Log in from an end-to-end test

Google OAuth does not support automated sign-in from a controlled embedded
browser. For local end-to-end tests, set a dedicated secret while starting the
development server:

```sh
E2E_AUTH_SECRET="$(openssl rand -hex 32)" bun run dev
```

Then create a normal application session through the Vite-proxied API route:

```ts
const response = await request.post('/api/__e2e/login', {
  headers: { 'x-e2e-auth': process.env.E2E_AUTH_SECRET! },
  data: { email: 'playwright@example.test', name: 'Playwright User' }
})
if (!response.ok()) throw new Error(`Test login failed: ${response.status()}`)
await request.storageState({ path: 'playwright/.auth/user.json' })
```

For a browser-only flow, navigate to the bootstrap route with the secret in the
URL fragment:

```ts
const fragment = new URLSearchParams({
  secret: process.env.E2E_AUTH_SECRET!,
  email: 'playwright@example.test',
  name: 'Playwright User',
  redirect: '/app'
})
await page.goto(`/api/__e2e/browser#${fragment}`)
await page.waitForURL('**/app')
```

#### Log in manually in a browser

1. Add a secret of at least 32 characters to the ignored root `.env` file:

   ```dotenv
   E2E_AUTH_SECRET=0123456789abcdef0123456789abcdef
   ```

2. Restart the development server with `bun run dev`.

3. Open the following URL on the website origin, replacing the example secret
   with the value from `.env`:

   ```text
   http://localhost:5173/api/__e2e/browser#secret=0123456789abcdef0123456789abcdef&redirect=%2Fapp
   ```

This signs in as the default `playwright@example.test` user. To choose the
email and display name, use URL-encoded `email` and `name` fragment parameters:

```text
http://localhost:5173/api/__e2e/browser#secret=YOUR_SECRET&email=me%40example.test&name=Test%20User&redirect=%2Fapp
```

Use `#secret=`, not `?secret=`, so the secret is not included in the initial
HTTP request.

The fragment is removed before the session request, and only same-origin redirect
targets are accepted.

The route is only mounted when `E2E_AUTH_SECRET` is non-empty and
`NODE_ENV` is not `production`. Production configuration rejects the variable.
Use an isolated local or CI database, generate a new secret for each environment,
and never commit the secret or Playwright storage state.

## Environment variables

### API runtime

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | Defaults to `development`; `bun run start` forces `production`. |
| `PORT` | No | API listen port, default `8002`. |
| `SQLITE_PATH` | No | SQLite database path; defaults to `./data/shlk.sqlite` from the API workspace. |
| `APP_SESSION_SECRET` | Yes | Signs session IDs; production requires 32 or more non-placeholder characters. |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth web-client ID. |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth web-client secret. |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback; production requires HTTPS. |
| `WEB_RISK_API_KEY` | No | Enables asynchronous Google Web Risk checks for short-link destinations. |
| `E2E_AUTH_SECRET` | No | Enables the test-only `/api/__e2e/login` route outside production. |
| `WEB_APP_URL` | Yes | Website origin used for CORS and OAuth/logout redirects; production requires HTTPS. |
| `PUBLIC_SERVICE_URL` | Yes | Absolute base used when the API creates short URLs; production requires HTTPS. |
| `DISPLAY_SERVICE_URL` | Yes | Human-readable short-link host shown in UI and API results. |
| `EXTENSION_ORIGIN` | Yes | Exact `chrome-extension://<id>` origin allowed by credentialed API CORS. |
| `TRUST_PROXY` | No | `0`/`false` disables proxy trust; a positive integer trusts that many hops; otherwise passed as an explicit Express trust-proxy value. |

Do not set `TRUST_PROXY=true` unless every path to the app is protected by a
trusted proxy. The provided Compose deployment uses `1`, meaning exactly one
TLS reverse-proxy hop.

### Vite build variables

| Variable | Purpose |
| --- | --- |
| `VITE_BACKEND_URL` | Absolute API origin used by the extension; also generates its sole host permission. |
| `VITE_PUBLIC_SERVICE_URL` | Base used when the frontend constructs short URLs. |
| `VITE_DISPLAY_SERVICE_URL` | Human-readable short-link host shown in the frontend. |
| `VITE_EXTENSION_STORE_URL` | Chrome Web Store link shown on the website. |
| `WEB_APP_URL` | Also embedded as the sole website allowed to message the extension. |
| `EXTENSION_ORIGIN` | Also supplies the stable extension ID used by the website handshake. |

All `VITE_*` values are public and embedded in built JavaScript. Never place
credentials in them. Changes require rebuilding the website and extension.

## Website and extension modes

The target is selected at build time; there is no runtime switch.

| Command | Target and behavior | Output |
| --- | --- | --- |
| `bun run dev` | API watch mode plus Vite website server, browser routing and proxying. | In-memory website |
| `bun run dev:extension` | API watch mode plus a watched extension-development build, hash routing, browser APIs and one-minute background checks. | `apps/web/dist/extension` |
| `bun run build` | API type validation plus optimized website and extension builds. | Both directories under `apps/web/dist` |

### Develop the extension

1. Run `bun run dev:extension` and wait for the first build.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
   and select `apps/web/dist/extension`.
3. Copy the assigned extension ID, set
   `EXTENSION_ORIGIN=chrome-extension://<id>` in `.env`, and restart the command
   so the API CORS allowlist is refreshed.
4. Pin and open the extension. Inspect the popup for UI logs and use the
   service-worker link on `chrome://extensions` for background logs.

The watch build updates files but does not reload Chrome. Reopen the popup for
popup-only changes. Reload the extension for service-worker or manifest
changes; content scripts would also require refreshing their host page. These
rules follow Chrome's
[unpacked-extension workflow](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).

## Tests and checks

Run the complete local gate from the repository root:

```sh
bun run lint
bun run typecheck
bun run test
bun run build
```

Use `bun run test`, not bare `bun test`. Bare `bun test` invokes Bun's runner on
the Vitest browser suites without their jsdom/Vite configuration.

Useful focused commands:

```sh
bun run test:api
bun run test:web
bun run --filter @shlk/web test:watch
```

- API tests live in `apps/api/test`, import from `bun:test`, and use an in-memory
  migrated SQLite database.
- Web tests live in `apps/web/test`, import from `vitest`, use jsdom and React
  Testing Library, and share browser mocks in `test/setup.ts`.
- Name new files `*.test.ts` or `*.test.tsx`. Prefer behavior-level assertions,
  Testing Library queries and user events over component internals. Mock
  network and Chrome APIs at the boundary and restore mocks between tests.

There is currently no browser-driven extension/e2e suite and no enforced
coverage threshold.

## Production build without Docker

Set production API values and public `VITE_*` values in the process environment
or an ignored env file, then run:

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
bun run start
```

`bun run start` runs the API as Bun-executed TypeScript on port 8002. It also
serves `apps/web/dist/web`; there is no compiled API executable. Place it behind
HTTPS and forward `X-Forwarded-Proto: https`. Production session cookies are
`HttpOnly`, `Secure`, and `SameSite=Lax`.

Build results:

| Path | Production result |
| --- | --- |
| `apps/web/dist/web` | Static website served by the production API. |
| `apps/web/dist/extension` | Unpacked extension with `manifest.json`, popup assets and `js/background.js`. |

Confirm the production extension manifest contains the intended HTTPS backend
permission and no localhost permission before distribution.

## Docker deployment

Copy and fill the production template. Compose stores the SQLite database in a
local named volume mounted read/write into the otherwise read-only container.

```sh
cp .env.docker.example .env.docker
openssl rand -hex 32  # APP_SESSION_SECRET
docker compose --env-file .env.docker config
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps
curl --fail http://127.0.0.1:8002/rest/ping
```

The stack builds the `runtime` target, runs it as the unprivileged `bun` user,
applies checked-in Drizzle migrations, and persists the database and WAL files in
the `sqlite-data` volume.
The app binds to `127.0.0.1:8002` by default.

Put a one-hop TLS reverse proxy in front of that bind address before using login
or serving users. Keep `TRUST_PROXY=1` only when that topology is accurate.
Run exactly one writable application instance for a SQLite file. Back up and
restore the volume as a database unit; never copy only the live main file without
its WAL state.

### Export the store extension

The production image intentionally contains only the website. Build, validate,
and upload the separate extension ZIP by following the
[Chrome extension release guide](chrome-extension-release.md). It documents the
recommended Docker artifact, an optional local package, generated-manifest
checks, unpacked production testing, dashboard submission, and the release
checklist.

## Known workflow and operations gaps

- There is no CI workflow, dependency-update automation or automated container
  build. Run the full local gate for every change.
- Extension development uses a watched, minified build without HMR or source
  maps and requires manual browser reloads.
- There are no extension integration/e2e tests, API database integration tests,
  or enforced coverage thresholds.
- ESLint disables several normally useful TypeScript safety rules, and the
  repository has no formatter/check script.
- The optional Compose override replicates SQLite to a local Litestream path;
  it is not high availability or host-loss protection unless independently stored.
- TLS certificates, reverse-proxy configuration, database backups, secret
  management, centralized logs, metrics and alerts are outside this repository
  and must be supplied by the deployment environment.
