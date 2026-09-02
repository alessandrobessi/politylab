import type { SimContext } from '../context';
import type { World } from '../models/world';

/**
 * Phase 11 — Warfare (BLUEPRINT.md §22–§23, §24; MODEL.md §55–§63): annual
 * combat resolution, casualties, economic damage, war exhaustion, peace. No-op
 * scaffold; milestone 16.
 */
export function resolveWarfare(_world: World, _ctx: SimContext): void {}

/**
 * Phase 12 — Territorial changes (BLUEPRINT.md §24; MODEL.md §60): probabilistic
 * region capture and transfer once superiority is sustained. No-op scaffold;
 * milestone 16.
 */
export function applyTerritorialChanges(_world: World, _ctx: SimContext): void {}
