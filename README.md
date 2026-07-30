# SHLK monorepo

The SHLK website, Manifest V3 extension, and API share one Bun workspace.

## Setup

1. Install Bun 1.3.14.
2. Copy `.env.example` to `.env` and set the required values.
3. Run `bun install`.

## Commands

- `bun run dev` starts the Bun API on port 8002 and the Vite website on port 5173.
- `bun run dev:extension` starts the API and continuously rebuilds the unpacked extension.
- `bun run build` validates the API and builds the website and extension.
- `bun run start` runs the production API, which serves `apps/web/dist/web`.
- `bun run lint`, `bun run typecheck`, and `bun test` run workspace checks.

ESLint 10 uses an isolated TypeScript 6 compiler-API tooling workspace because
TypeScript 7 does not expose the API required by `typescript-eslint`; application
compilation remains pinned to TypeScript 7.0.2. Bun also preloads a narrow BSON
snapshot-probe compatibility shim for MongoDB 7.5 on Bun 1.3.14.

Set `EXTENSION_ORIGIN` to the exact installed `chrome-extension://<id>` origin so
the API can allow credentialed extension requests without broadly enabling CORS.

Load `apps/web/dist/extension` as an unpacked browser extension after running the
extension build.

The original repositories are intentionally not referenced by this workspace.
