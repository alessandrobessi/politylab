import type { SimulationConfig } from '../config';
import type { SimContext } from '../context';
import { CauseSet } from '../events/causes';
import { clamp01, mean, safeDivide } from '../math';
import { TECH_DOMAINS, type TechDomain, type TechnologyState } from '../models/state';
import type { World } from '../models/world';

/**
 * Phase 6 — Technology (BLUEPRINT.md §14–§15, §24; MODEL.md §22–§25, §73).
 *
 * Each of the eight domains advances independently through:
 *   - domestic innovation (MODEL.md §23): research intensity × education ×
 *     institutions × domain priority, with diminishing returns `(1−T)^1.5`
 *   - diffusion (MODEL.md §25): from more-advanced, trading, friendly, nearby
 *     states — requires a positive gap and is capped at `maxAnnualDiffusion`
 *
 * Domestic innovation dominates diffusion at default parameters, so states
 * diverge technologically while diffusion still pulls laggards up (MODEL.md §77).
 * Diffusion inputs (trade, opinion, proximity) come from bilateral relations;
 * they are near-static until trade (M12) and diplomacy (M11) make them evolve.
 */

/** Composite technology index — UI/statistics only (MODEL.md §73). */
export function technologyIndex(technology: TechnologyState): number {
	return mean(Object.values(technology));
}

/** One domain's domestic innovation for the year (MODEL.md §23). */
export function computeDomesticInnovation(
	tech: number,
	researchIntensity: number,
	education: number,
	institutionalCapacity: number,
	domainPriority: number,
	config: SimulationConfig
): number {
	const c = config.technology;
	return (
		c.innovationRate *
		(researchIntensity / c.researchReferenceIntensity) *
		(0.4 + 0.6 * education) *
		(0.5 + 0.5 * institutionalCapacity) *
		Math.max(0, 1 - tech) ** 1.5 *
		domainPriority
	);
}

/**
 * One domain's diffusion from a single partner (MODEL.md §25). Zero unless the
 * state is more than `diffusionGapFloor` behind the partner (see §92) — so
 * near-peers stay spread while true laggards are pulled up.
 */
export function computeDiffusion(
	ownTech: number,
	otherTech: number,
	tradeIntensity: number,
	diplomaticOpenness: number,
	proximity: number,
	config: SimulationConfig
): number {
	const gap = Math.max(0, otherTech - ownTech - config.technology.diffusionGapFloor);
	return gap * config.technology.diffusionRate * tradeIntensity * diplomaticOpenness * proximity;
}

export function updateTechnology(world: World, ctx: SimContext): void {
	const c = ctx.config.technology;

	// Freeze everyone's technology so diffusion reads pre-innovation values,
	// independent of iteration order.
	const before = new Map<string, TechnologyState>();
	for (const state of world.states) {
		if (state.alive) before.set(state.id, { ...state.technology });
	}

	for (const state of world.states) {
		if (!state.alive) continue;
		const own = before.get(state.id)!;

		const researchIntensity = safeDivide(state.spending.research, state.gdp, 0);
		const domestic = {} as Record<TechDomain, number>;
		const diffused = {} as Record<TechDomain, number>;

		for (const domain of TECH_DOMAINS) {
			domestic[domain] = computeDomesticInnovation(
				own[domain],
				researchIntensity,
				state.education,
				state.politics.institutionalCapacity,
				state.researchPriorities[domain],
				ctx.config
			);

			let diffusion = 0;
			for (const other of world.states) {
				if (other === state || !other.alive) continue;
				const rel = state.relations[other.id];
				if (!rel || rel.atWar) continue;
				const openness = clamp01(0.5 + 0.5 * rel.opinion);
				diffusion += computeDiffusion(
					own[domain],
					before.get(other.id)?.[domain] ?? 0,
					rel.trade,
					openness,
					rel.proximity,
					ctx.config
				);
			}
			diffused[domain] = Math.min(diffusion, c.maxAnnualDiffusion);
		}

		for (const domain of TECH_DOMAINS) {
			state.technology[domain] = clamp01(own[domain] + domestic[domain] + diffused[domain]);
		}

		if (ctx.traces) {
			const causes = new CauseSet();
			causes.add(
				'domestic_innovation',
				mean(TECH_DOMAINS.map((d) => domestic[d])),
				researchIntensity
			);
			causes.add('diffusion', mean(TECH_DOMAINS.map((d) => diffused[d])));
			ctx.traces.record(state.id, 'technologyGrowth', causes.list());
		}
	}
}
