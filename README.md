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

**v0.1 feature-complete** — all 27 milestones landed. The BLUEPRINT §51 release
checklist is met: seeded procedural worlds; distinct geography & economy per
state; evolving population & economies; technology development and diffusion;
trade; evolving diplomacy; emergent alliances; war declarations; wars that
change territory and domestic conditions; government instability and
transitions; a historical event feed; click-to-inspect states; causal "Why?"
panels; determinism; 1,000 years with no numerical failure; and different seeds
producing meaningfully different histories.

A 100-world × 500-year Monte Carlo batch (`pnpm mc`) trips none of the MODEL §78
pathology rules. Two soft calibration watches (state elimination is low;
technology convergence is high) are recorded in the MODEL §92 changelog for a
dedicated post-v0.1 calibration pass.

See:

- [`BLUEPRINT.md`](./BLUEPRINT.md) — product behaviour, architecture, and the
  27-milestone implementation plan.
- [`MODEL.md`](./MODEL.md) — state variables, equations, coefficients, numerical
  constraints, and modelling assumptions (plus the calibration changelog, §92).

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
pnpm mc       # headless Monte Carlo batch (--worlds N --years M --seed S [--json out])
```

`pnpm test`, `pnpm check`, and `pnpm build` all pass; each was a gate before its
milestone commit. `MC_HEAVY=1 pnpm test` additionally runs the 100-world ×
10,000-year stability batch.

## Deployment

Pushing to `main` builds the static site with `BASE_PATH=/politylab` and
publishes it to GitHub Pages via `.github/workflows/deploy.yml`. Live at
<https://alessandrobessi.github.io/politylab/>.
