# v1 Release Plan

The foundation phases are complete. The next phases remove mocked reasoning, connect live systems, harden external use, and deploy v1.

## Command Flow

Continue using the same plain-text commands:

```text
next phase 9
review phase 9
fix phase 9
next phase 10
```

Do not skip to deployment until live LLMs, live tools, external API hardening, and workflow hardening are complete.

## v1 Release Sequence

```text
Phase 9  -> real LLM gateway and agents
Phase 10 -> live tool integrations
Phase 11 -> external integration API
Phase 12 -> production workflow hardening
Phase 13 -> deployment
Phase 14 -> release gate
```

## Phase 9 Output

The product should stop relying on mocked agent outputs for normal runs. A user should be able to submit an investigation and receive a report written by live Director, Expert, Critic, Counsel, and Reporter calls.

Test mocks should remain, but production workflow code should choose the live path by default.

## Phase 10 Output

The agents should inspect real tool results when credentials are configured. Missing integrations should create evidence gaps instead of invented facts.

## Phase 11 Output

An external developer should know how to create an investigation, stream events, inspect evidence, and read a report using documented API contracts.

## Phase 12 Output

Retries, duplicate events, workflow failures, SSE reconnects, migrations, and observability should be production-safe.

## Phase 13 Output

Argus should be deployed with real secrets, real database, running worker, running API, and reachable dashboard.

## Phase 14 Output

The release should be gated by checks, eval metrics, security review, documentation, and a v1 tag.
