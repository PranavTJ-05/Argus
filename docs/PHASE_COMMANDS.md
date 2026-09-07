# Phase Commands

Use these short commands to guide agentic coding without rewriting the full plan.

These commands are plain text conventions. Do not prefix them with `/` in clients that reserve slash commands for built-in UI actions.

## Commands

### `next phase <number>`

Example:

```text
next phase 0
```

Meaning:

- Read `AGENTS.md`.
- Read `docs/BUILD_ORDER.md`.
- Read `docs/ENGINEERING_RULES.md`.
- Read `docs/PHASE_STATUS.md`.
- Work only on the next unfinished task inside that phase.
- Keep the change small.
- Do not skip to later phases.
- Run relevant checks.
- Update `docs/PHASE_STATUS.md` after finishing.

### `status`

Meaning:

- Inspect the repo.
- Read `docs/PHASE_STATUS.md`.
- Report current phase progress.
- Do not edit files unless explicitly asked.

### `review phase <number>`

Example:

```text
review phase 0
```

Meaning:

- Review the implementation for that phase.
- Check against `docs/BUILD_ORDER.md`, `docs/ENGINEERING_RULES.md`, and `AGENTS.md`.
- Report bugs, missing work, architectural drift, and test gaps.
- Do not make changes unless explicitly asked.

### `fix phase <number>`

Example:

```text
fix phase 0
```

Meaning:

- Fix issues found in the current phase implementation.
- Keep changes limited to that phase.
- Run relevant checks.
- Update `docs/PHASE_STATUS.md`.

## Recommended Flow

Use this loop:

```text
next phase 0
review phase 0
fix phase 0
next phase 0
```

When Phase 0 is complete:

```text
next phase 1
```

## Agent Rules for Phase Commands

When a user gives a phase command:

- Do not ask for the whole plan again.
- Use the repository docs as the source of truth.
- Prefer the smallest useful vertical change.
- Do not implement optional or v2 work.
- Do not change architecture decisions unless the user explicitly asks.
- If the phase is already complete, say so and suggest the next phase.
