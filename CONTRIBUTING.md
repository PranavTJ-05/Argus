# Contributing

1. Use Node 22 (`.nvmrc`) and pnpm 10.
2. `cp .env.example .env`, then `pnpm install` and `pnpm db:up`.
3. Run `pnpm check` and `pnpm format:check` before opening a PR.
4. Read `AGENTS.md` and `docs/architecture/engineering-standards.md` first. Architecture choices there are fixed unless discussed.
5. Keep commits small and scoped, with imperative messages.
