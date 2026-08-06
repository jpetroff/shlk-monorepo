# Commands
From repository root:
- `bun install --frozen-lockfile` — install exact workspace dependencies.
- `bun run dev` — API watch server on 8002 plus Vite web server on 5173.
- `bun run dev:extension` — API watch server plus watched extension build.
- `bun run lint`; `bun run typecheck`; `bun run test`; `bun run build` — repository checks.
- `bun run test:api`; `bun run test:web` — focused suites.
- `bun run --filter @shlk/web test:watch` — web test watch mode.
- `bun run start` — production-mode API serving built website.
- Health endpoint: `http://localhost:8002/rest/ping`; dev GraphiQL: `http://localhost:5173/__graphiql`.