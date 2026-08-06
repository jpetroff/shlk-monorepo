# Completion gate
From repository root, run in order:
1. `bun run lint`
2. `bun run typecheck`
3. `bun run test`
4. `bun run build`
Use focused API/web test commands during iteration, but the full gate defines completion. There is no formatter/check command or CI fallback.