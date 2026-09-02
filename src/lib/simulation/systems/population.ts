import type { SimulationConfig } from '../config';
import type { SimContext } from '../context';
import { CauseSet } from '../events/causes';
import { clamp, clamp01, finiteOrFallback, safeDivide } from '../math';
import type { World } from '../models/world';
import { regionsByOwner, welfareEffect } from './common';
import { computeFoodCapacity } from './food';

/**
 * Phase 2 — Population (BLUEPRINT.md §11, §24; MODEL.md §6–§11).
 *
 *   P_{t+1} = P_t + P_t·(b − d) − W
 *   b = birth rate (MODEL.md §7), d = death rate (MODEL.md §8), W = war deaths
 *
 * Food capacity is recomputed each year from the state's regions (MODEL.md §9);
 * food stress raises mortality quadratically (MODEL.md §11), which — with static
 * technology in v0.1's early milestones — gives a Malthusian ceiling rather than
 * unbounded growth. War deaths are wired in milestone 16.
 */

/** MODEL.md §7. Clamped to [0.008, 0.040]. */
export function computeBirthRate(
	education: number,
	urbanization: number,
	prosperity: number,
	config: SimulationConfig
): number {
	const p = config.population;
	const raw =
		p.baseBirthRate -
		p.educationBirthEffect * education -
		p.urbanBirthEffect * urbanization -
		p.prosperityBirthEffect * prosperity;
	return clamp(raw, 0.008, 0.04);
}

/** MODEL.md §8, excluding famine. Clamped to [0.006, 0.040]. */
export function computeNormalDeathRate(
	medicineTech: number,
	prosperity: number,
	welfare: number,
	config: SimulationConfig
): number {
	const p = config.population;
	const raw =
		p.baseDeathRate -
		p.medicineDeathEffect * medicineTech -
		p.prosperityDeathEffect * prosperity -
		p.welfareDeathEffect * welfare;
	return clamp(raw, 0.006, 0.04);
}

/** MODEL.md §11. Quadratic in food stress; may push mortality above the normal cap. */
export function computeFamineMortality(foodStress: number, config: SimulationConfig): number {
	return config.population.maxFamineMortality * foodStress * foodStress;
}

export function updatePopulation(world: World, ctx: SimContext): void {
	const owned = regionsByOwner(world);
	const scale = ctx.config.food.areaCapacityScale;

	for (const state of world.states) {
		if (!state.alive) continue;
		const regions = owned.get(state.id) ?? [];

		const foodCapacity = computeFoodCapacity(
			state.technology.agriculture,
			state.politics.stability,
			regions,
			scale
		);
		const startPopulation = state.population;
		const foodRatio = startPopulation > 0 ? safeDivide(foodCapacity, startPopulation, 10) : 10;
		const foodStress = clamp01((1 - foodRatio) / 0.4);

		const birthRate = computeBirthRate(
			state.education,
			state.urbanization,
			state.prosperity,
			ctx.config
		);
		const normalDeathRate = computeNormalDeathRate(
			state.technology.medicine,
			state.prosperity,
			welfareEffect(state, ctx.config),
			ctx.config
		);
		const famineMortality = computeFamineMortality(foodStress, ctx.config);
		const deathRate = normalDeathRate + famineMortality;

		const warDeaths = 0; // milestone 16
		const growthRate = birthRate - deathRate;

		let nextPopulation = startPopulation + startPopulation * growthRate - warDeaths;
		nextPopulation = Math.max(1, finiteOrFallback(nextPopulation, startPopulation));

		// Keep region populations consistent with the state total.
		const ratio = safeDivide(nextPopulation, startPopulation, 1);
		for (const region of regions) region.population = Math.max(0, region.population * ratio);

		state.population = nextPopulation;
		state.foodCapacity = foodCapacity;
		state.foodRatio = foodRatio;
		state.foodStress = foodStress;
		state.growth.population = growthRate;

		if (ctx.traces) {
			const causes = new CauseSet();
			causes.add('births', birthRate, birthRate);
			causes.add('deaths', -normalDeathRate, normalDeathRate);
			if (famineMortality > 0) causes.add('famine', -famineMortality, foodStress);
			ctx.traces.record(state.id, 'populationGrowth', causes.list());
		}
	}
}
