# Web module
- React/Vite source under `apps/web/src`; shared JS/GraphQL clients under `src/js`, pages under `src/pages`, styles under `src/css`.
- One codebase builds two targets: website (browser routing/Vite proxy) and Manifest V3 extension (hash routing/browser APIs).
- Vite website development URL is `http://localhost:5173`; backend proxy routes include `/api`, `/oauth`, `/logout`, and `/rest`.
- Database migrations should not alter frontend code if API GraphQL and ID/string contracts are preserved.
- Web tests use Vitest/jsdom and Testing Library under `apps/web/test`.