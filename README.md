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
application instance with a persistent local SQLite volume. Copy
`.env.docker.example` to ignored `.env.docker`, fill every placeholder, and
follow the deployment checklist in the development guide.

SQLite runs in WAL mode with foreign keys, a busy timeout, and full synchronous
writes. The application applies checked-in Drizzle migrations before listening.
Use only one writable application instance for a database file; backup and
optional Litestream replication remain deployment responsibilities.

ESLint 10 uses an isolated TypeScript 6 compiler-API tooling workspace because
TypeScript 7 does not expose the API required by `typescript-eslint`; application
compilation remains pinned to TypeScript 7.0.2.

The original repositories are intentionally not referenced by this workspace.
