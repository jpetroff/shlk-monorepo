# SHLK monorepo

The SHLK website, Manifest V3 extension, and API share one Bun workspace.

The full clone-to-development, testing, extension and production guide is in
[`docs/development.md`](docs/development.md).

## Quick start

1. Install Bun 1.3.14, MongoDB and Chrome/Chromium.
2. Copy `.env.example` to `.env`, add Google OAuth credentials, and replace the
   session-secret placeholder.
3. Run `bun install --frozen-lockfile`.
4. Start a MongoDB instance and run `bun run dev`.

## Commands

- `bun run dev` starts the Bun API on port 8002 and Vite website on port 5173.
- `bun run dev:extension` starts the API and watches the unpacked extension in
  `apps/web/dist/extension`.
- `bun run lint`, `bun run typecheck`, and `bun run test` run the local checks.
- `bun run build` validates the API and builds optimized website and extension
  artifacts.
- `bun run start` runs the production API and serves `apps/web/dist/web`.

Use `bun run test`, not bare `bun test`: the web workspace uses Vitest/jsdom,
while the API uses Bun's test runner. Focused commands are `bun run test:api`
and `bun run test:web`.

## Production

The multi-stage `Dockerfile` builds a non-root API/web runtime image and a
separate `extension-artifact` ZIP target. `compose.yaml` runs the image with an
authenticated MongoDB 8.0 service. Copy `.env.docker.example` to ignored
`.env.docker`, fill every placeholder, and follow the deployment checklist in
the development guide.

ESLint 10 uses an isolated TypeScript 6 compiler-API tooling workspace because
TypeScript 7 does not expose the API required by `typescript-eslint`; application
compilation remains pinned to TypeScript 7.0.2. Bun also preloads a narrow BSON
snapshot-probe compatibility shim for MongoDB 7.5 on Bun 1.3.14.

The original repositories are intentionally not referenced by this workspace.
