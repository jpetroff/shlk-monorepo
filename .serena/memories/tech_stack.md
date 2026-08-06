# Toolchain
- Package manager/runtime: Bun 1.3.14, pinned in root `packageManager`.
- Language: strict TypeScript 7.0.2, ESM (`"type": "module"`), target ES2024; API uses Bun-executed TypeScript.
- API: Express 5, GraphQL 17 + GraphQL Tools, express-session, Google OAuth libraries.
- Web: React 19, React Router 8, Vite 8, Less; also builds a Manifest V3 Chrome extension.
- Tests: Bun test runner for `apps/api/test`; Vitest/jsdom + Testing Library for `apps/web/test`.
- Lint: ESLint 10 in isolated `tools/lint` workspace because TypeScript 7 lacks the compiler API required by typescript-eslint; lint tooling uses its own TypeScript 6-compatible dependencies.