# Conventions
- Strict TypeScript and ESM imports; source is organized by small modules under each app.
- Preserve the GraphQL contract at repository boundaries: persistence adapters return plain domain objects with current `_id`, nested object, string timestamp, and optional-field shapes.
- API tests use `bun:test`; web tests use Vitest and Testing Library. Name tests `*.test.ts` or `*.test.tsx`.
- Prefer behavior assertions and boundary mocks; restore mocks between tests.
- No repository formatter command. Match existing no-semicolon, single-quote style.
- ESLint intentionally disables several TypeScript safety/unused rules; do not treat that as permission for unnecessary loose typing.
- Environment secrets belong in ignored `.env` files; `VITE_*` values are public build-time data.