import type { SimContext } from '../context';
import type { World } from '../models/world';

/**
 * Phase 4 — Government revenue (BLUEPRINT.md §13, §24; MODEL.md §16): GDP × tax
 * rate × tax efficiency. No-op scaffold; milestone 7/8.
 */
export function updateGovernmentRevenue(_world: World, _ctx: SimContext): void {}

/**
 * Phase 5 — Government spending (BLUEPRINT.md §13, §24; MODEL.md §17–§19):
 * allocation across the six budget lines and its downstream effects. No-op
 * scaffold; milestone 8.
 */
export function updateGovernmentSpending(_world: World, _ctx: SimContext): void {}
