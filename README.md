# PolityLab

**v0.1 — Emergent States**

A browser-based procedural geopolitical world simulator. Procedurally generated
states emerge, develop, trade, form alliances, wage wars, change governments,
advance technologically, rise, decline, and occasionally disappear. The user is
an **observer of history**: generate a world from a seed, press play, watch
centuries pass, and click any state or event to ask **why** it happened.

The design principle is: _do not script historical events — simulate mechanisms
capable of producing them_, and _whenever possible, be able to explain why
something happened_.

## Status

Under construction, milestone by milestone. See:

- [`BLUEPRINT.md`](./BLUEPRINT.md) — product behaviour, architecture, and the
  27-milestone implementation plan.
- [`MODEL.md`](./MODEL.md) — state variables, equations, coefficients, numerical
  constraints, and modelling assumptions (plus the calibration changelog).

## Architecture

```
UI (SvelteKit)
 ↓
Simulation Controller
 ↓
Simulation Engine        ← framework-free TypeScript, runs unmodified in Node
 ↓
Simulation Systems
 ↓
Domain Models
```

The engine (`src/lib/simulation/`, `src/lib/worldgen/`, `src/lib/montecarlo/`)
never imports Svelte or the DOM, is fully deterministic (seeded RNG only, no
`Math.random()`), and keeps all coefficients in configuration.

## Tech stack

SvelteKit 5 (runes) · TypeScript (strict) · pnpm · Vitest · `adapter-static`
(pure client app, no backend) · D3 for map/chart geometry · Web Worker for
high-speed simulation · IndexedDB for saved worlds.

## Commands

```sh
pnpm install
pnpm dev      # run the app
pnpm test     # vitest (engine determinism, invariants, long-run, directional)
pnpm check    # svelte-check + tsc
pnpm build    # static build
pnpm format   # prettier --write
```

`pnpm test`, `pnpm check`, and `pnpm build` must all pass before each milestone
is committed.
