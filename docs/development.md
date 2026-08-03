# Development and deployment

SHLK is a Bun workspace containing an Express/MongoDB API and one React/Vite
frontend that can be built either as a website or a Manifest V3 Chrome
extension.

## Prerequisites

- [Bun 1.3.14](https://bun.com/docs/installation). On macOS or Linux, install
  the pinned version with:

  ```sh
  curl -fsSL https://bun.com/install | bash -s "bun-v1.3.14"
  bun --version
  ```

- MongoDB reachable through a `mongodb://` or `mongodb+srv://` URI. A local
  MongoDB service is sufficient for development; the production Compose stack
  below supplies its own authenticated MongoDB.
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
3. Set `MONGO_URI` to a running database.
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

## Environment variables

### API runtime

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | Defaults to `development`; `bun run start` forces `production`. |
| `PORT` | No | API listen port, default `8002`. |
| `MONGO_URI` | Yes | MongoDB connection and session-store URI. |
| `APP_SESSION_SECRET` | Yes | Signs session IDs; production requires 32 or more non-placeholder characters. |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth web-client ID. |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth web-client secret. |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback; production requires HTTPS. |
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

- API tests live in `apps/api/test`, import from `bun:test`, and run with the
  BSON compatibility preload from the root `bunfig.toml`.
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

Copy and fill the production template. Use URL-safe hexadecimal MongoDB
passwords because Compose builds the connection URI from them.

```sh
cp .env.docker.example .env.docker
openssl rand -hex 32  # APP_SESSION_SECRET
openssl rand -hex 32  # MONGO_ROOT_PASSWORD
openssl rand -hex 32  # MONGO_APP_PASSWORD
docker compose --env-file .env.docker config
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps
curl --fail http://127.0.0.1:8002/rest/ping
```

The stack builds the `runtime` target, runs it as the unprivileged `bun` user,
creates a dedicated MongoDB application user, waits for MongoDB health, and
persists data in the `mongo-data` volume. MongoDB has no published host port.
The app binds to `127.0.0.1:8002` by default.

Put a one-hop TLS reverse proxy in front of that bind address before using login
or serving users. Keep `TRUST_PROXY=1` only when that topology is accurate.
Changing Mongo initialization credentials does not update an existing volume;
perform an explicit credential rotation instead of deleting production data.

### Export the store extension

The extension version in `apps/web/src/manifest.json` must be greater than the
currently published version. BuildKit can export a ZIP whose manifest is at the
archive root:

```sh
docker build \
  --target extension-artifact \
  --output type=local,dest=release \
  --build-arg VITE_BACKEND_URL=https://shlk.example \
  --build-arg VITE_PUBLIC_SERVICE_URL=https://shlk.example \
  --build-arg VITE_DISPLAY_SERVICE_URL=shlk.example \
  --build-arg VITE_EXTENSION_STORE_URL=https://chrome.google.com/webstore/detail/shlkcc-url-shortener/bjkhbppdemdfngnceocjmeapcfckfkok \
  .
unzip -t release/shlk-extension.zip
```

Inspect the ZIP and upload it through the Chrome Web Store developer dashboard.
The production image intentionally contains only the website; the ZIP is a
separate release artifact.

## Known workflow and operations gaps

- There is no CI workflow, dependency-update automation or automated container
  build. Run the full local gate for every change.
- Extension development uses a watched, minified build without HMR or source
  maps and requires manual browser reloads.
- There are no extension integration/e2e tests, API database integration tests,
  or enforced coverage thresholds.
- ESLint disables several normally useful TypeScript safety rules, and the
  repository has no formatter/check script.
- The Compose MongoDB service is a single persistent instance, not a replica set
  or managed high-availability database.
- TLS certificates, reverse-proxy configuration, database backups, secret
  management, centralized logs, metrics and alerts are outside this repository
  and must be supplied by the deployment environment.
