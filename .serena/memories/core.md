# Repository map
- Bun workspace monorepo. API: `apps/api`; React/Vite web + MV3 extension: `apps/web`; isolated ESLint workspace: `tools/lint`.
- Root scripts orchestrate workspace commands; use `bun run test`, never bare `bun test`.
- API-specific architecture and persistence boundaries: `mem:api/core`.
- Frontend build targets and boundaries: `mem:web/core`.
- Toolchain pins and dependency structure: `mem:tech_stack`.
- Project coding conventions: `mem:conventions`.
- Verification commands: `mem:task_completion`; day-to-day commands: `mem:suggested_commands`.
- Secrets live only in ignored env files. Never commit credentials.