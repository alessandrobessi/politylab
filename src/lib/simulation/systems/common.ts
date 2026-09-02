import type { SimulationConfig } from '../config';
import { clamp01 } from '../math';
import type { Region } from '../models/region';
import type { State } from '../models/state';
import type { World } from '../models/world';

/** Owned regions grouped by state id (unowned regions excluded). */
export function regionsByOwner(world: World): Map<string, Region[]> {
	const map = new Map<string, Region[]>();
	for (const region of world.regions) {
		if (region.ownerId === null) continue;
		let list = map.get(region.ownerId);
		if (!list) {
			list = [];
			map.set(region.ownerId, list);
		}
		list.push(region);
	}
	return map;
}

/** Government revenue as a fraction of GDP: taxRate × tax efficiency (MODEL.md §16). */
export function revenueFraction(state: State): number {
	return state.taxRate * (0.45 + 0.55 * state.politics.institutionalCapacity);
}

/** Government revenue in absolute units (MODEL.md §16). Defaults to `state.gdp`. */
export function revenue(state: State, gdp: number = state.gdp): number {
	return gdp * revenueFraction(state);
}

/** Welfare outlay as a fraction of GDP (budget share × revenue fraction). */
export function welfareIntensity(state: State): number {
	return state.budget.welfare * revenueFraction(state);
}

/**
 * Bounded welfare effect in 0..1, used by mortality (MODEL.md §8) and political
 * support (MODEL.md §30). Welfare spending relative to a reference intensity.
 */
export function welfareEffect(state: State, config: SimulationConfig): number {
	return clamp01(welfareIntensity(state) / config.welfare.referenceIntensity);
}
