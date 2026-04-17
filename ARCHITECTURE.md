# Architecture

## High-Level Flow

1. IntentEngine classifies user goal.
2. ModeRouter selects task mode.
3. Specialized agents execute in parallel:
   - strategist
   - architect
   - analyst
   - critic
   - executor
4. FusionEngine merges agent outputs.
5. DecisionEngine ranks candidates with scored criteria and selects winner.
6. MemoryGraph retrieval expands prompt context with relevant prior memories/builds.
7. ExecutionEngine emits staged response and artifacts.

## Source Layout

- src/core
  - intent-engine.ts
  - mode-router.ts
  - fusion-engine.ts
  - decision-engine.ts
  - execution-engine.ts
  - pipeline.ts
- src/agents
  - strategist.ts
  - architect.ts
  - analyst.ts
  - critic.ts
  - executor.ts
- src/memory
  - memory-graph.ts
  - runtime-memory.ts
- src/services
  - model-router.ts
  - scoring.ts
  - analytics.ts
- src/api
  - chat.ts
  - build.ts
  - decision.ts
- src/ui
  - components
  - layout
  - themes

## API Surface

- POST /v1/ces/chat
- POST /v1/ces/build
- POST /v1/ces/decision
- POST /v1/ces/memory/analyze
- POST /v1/auth/register
- POST /v1/auth/login
- POST /v1/auth/refresh
- POST /v1/auth/oauth/google
- POST /v1/billing/checkout

## Security Design

- JWT access and refresh tokens for session auth.
- Input schema validation via zod.
- Existing API rate limiting middleware remains active.
- Server-only secrets for provider and Stripe keys.

## UI Design System

- Ice blue glass theme (default)
- Dark Minimal theme
- Light theme
- Left panel: modes and sessions
- Center panel: execution/chat
- Right panel: thinking telemetry
- Cognitive Execution System (CES) chat route accepts optional memoryContext and pastBuilds arrays.
