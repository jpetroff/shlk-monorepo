# API module
- Entry: `apps/api/src/index.ts`; configuration: `apps/api/src/config.ts`; Express assembly/routing under `src/libs`; GraphQL schema/resolvers under `src/graphql`.
- Persistence queries are isolated in `src/libs/*queries.ts`; domain/model types historically live under `src/models`.
- Session middleware is assembled from the database connection/store and OAuth writes a string user ID to the session.
- Keep GraphQL schema/client-visible shapes stable when changing persistence.
- Dev server: `bun --preload ./src/bun-compat.ts --watch src/index.ts`; production executes TypeScript directly with Bun.
- API tests are under `apps/api/test` and run via the root `test:api` script.