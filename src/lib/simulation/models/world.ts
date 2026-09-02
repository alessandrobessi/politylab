import type { SimulationConfig } from '../config';
import type { Region } from './region';
import type { State } from './state';
import type { War } from './war';
import type { WorldEvent } from './event';

export type Vec2 = readonly [number, number];

/**
 * The complete simulation state (BLUEPRINT.md §8). Plain serializable data — no
 * RNG, no methods, no history. The per-tick RNG is derived from `(seed, year)`
 * by the engine; time series and snapshots live in `WorldHistory` alongside the
 * world, not inside it, so snapshots don't nest history (MODEL.md §27).
 */
export interface World {
	seed: number;
	year: number;

	/** Map bounds; region sites and polygons live in this coordinate space. */
	width: number;
	height: number;

	states: State[];
	regions: Region[];
	wars: War[];
	events: WorldEvent[];

	config: SimulationConfig;

	/** Monotonic counter for deterministic entity ids (events, wars). */
	nextId: number;
}

/** Allocate the next deterministic id with the given prefix, advancing `world.nextId`. */
export function allocateId(world: World, prefix: string): string {
	const id = `${prefix}-${world.nextId}`;
	world.nextId += 1;
	return id;
}
