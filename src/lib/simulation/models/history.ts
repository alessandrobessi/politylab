import type { Cause } from '../events/causes';
import type { GovernmentType } from './state';
import type { World } from './world';

/**
 * Historical record kept alongside the world (BLUEPRINT.md §27, MODEL.md §72):
 * lightweight annual per-state stats plus periodic full world snapshots. Held
 * separately from `World` so a snapshot's cloned world does not nest history.
 */

/** Recorded once per state per year (MODEL.md §72). */
export interface StateYearStats {
	year: number;
	stateId: string;
	alive: boolean;
	population: number;
	gdp: number;
	gdpPerCapita: number;
	/** Mean of the eight technology domains (MODEL.md §73). */
	technologyIndex: number;
	stability: number;
	legitimacy: number;
	militaryPower: number;
	territory: number;
	governmentType: GovernmentType;
	/** Causal contributors to this year's explainable metrics, by metric name. */
	causes?: Record<string, Cause[]>;
}

export interface WorldSnapshot {
	year: number;
	/** Deep copy of the world at this year (no nested history). */
	world: World;
}

export interface WorldHistory {
	/** Annual stats per state id, in ascending year order. */
	byState: Record<string, StateYearStats[]>;
	/** Full snapshots, every `config.history.snapshotInterval` years. */
	snapshots: WorldSnapshot[];
}

export function createHistory(): WorldHistory {
	return { byState: {}, snapshots: [] };
}
