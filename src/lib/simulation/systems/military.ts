import type { SimulationConfig } from '../config';
import type { SimContext } from '../context';
import { clamp01, safeDivide } from '../math';
import type { World } from '../models/world';
import { regionsByOwner } from './common';

/**
 * Military capital and effective power (BLUEPRINT.md §22; MODEL.md §41–§43).
 * Runs right after government spending: the military budget line accumulates
 * into a capital stock (with depreciation), and power is derived from that stock
 * plus manpower, military technology, logistics, and morale.
 *
 * Military spending has an opportunity cost — it is revenue not spent on
 * infrastructure, education, or research — and, above ~8% of GDP, an added
 * political cost (MODEL.md §43), applied by the politics system.
 */

/** Military capital next year (MODEL.md §41). Never negative. */
export function accumulateMilitaryCapital(
	capital: number,
	investment: number,
	warLosses: number,
	config: SimulationConfig
): number {
	return Math.max(0, capital + investment - config.military.depreciation * capital - warLosses);
}

/** Effective military power (MODEL.md §42). */
export function computeMilitaryPower(
	militaryCapital: number,
	population: number,
	militaryTech: number,
	transportTech: number,
	meanInfrastructure: number,
	stability: number
): number {
	const manpower = Math.max(0, population) ** 0.25;
	const technology = 0.5 + militaryTech;
	const logistics = 0.6 + 0.2 * transportTech + 0.2 * meanInfrastructure;
	const morale = 0.7 + 0.3 * stability;
	return Math.sqrt(Math.max(0, militaryCapital)) * manpower * technology * logistics * morale;
}

export function updateMilitary(world: World, ctx: SimContext): void {
	const owned = regionsByOwner(world);

	for (const state of world.states) {
		if (!state.alive) continue;
		const regions = owned.get(state.id) ?? [];
		const meanInfrastructure = regions.length
			? regions.reduce((sum, r) => sum + r.infrastructure, 0) / regions.length
			: 0;

		const warLosses = 0; // milestone 16
		state.military.capital = accumulateMilitaryCapital(
			state.military.capital,
			state.spending.military,
			warLosses,
			ctx.config
		);
		state.military.power = computeMilitaryPower(
			state.military.capital,
			state.population,
			state.technology.military,
			state.technology.transport,
			meanInfrastructure,
			state.politics.stability
		);
		state.military.burden = safeDivide(state.spending.military, state.gdp, 0);
		state.military.morale = clamp01(0.5 + 0.4 * state.politics.stability);
	}
}
