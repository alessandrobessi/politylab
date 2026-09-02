import type { Region } from '../models/region';

/**
 * Total annual food-production capacity of a state's territory (MODEL.md §9).
 *
 *   F_r = scale · area_r · Q_r · Ta · I_r · S
 *   Ta  = 0.65 + 1.10 · agricultureTech        (state)
 *   I_r = 0.75 + 0.50 · infrastructure_r       (region)
 *   S   = 0.75 + 0.25 · stability              (state)
 *
 * `scale` (config.food.areaCapacityScale) puts the result in the same units as
 * population. Shared by world generation and the population system so the two
 * always agree.
 */
export function computeFoodCapacity(
	agricultureTech: number,
	stability: number,
	ownedRegions: readonly Region[],
	areaCapacityScale: number
): number {
	const techModifier = 0.65 + 1.1 * agricultureTech;
	const stabilityModifier = 0.75 + 0.25 * stability;
	let total = 0;
	for (const r of ownedRegions) {
		const infraModifier = 0.75 + 0.5 * r.infrastructure;
		total +=
			areaCapacityScale *
			r.area *
			r.agriculturalPotential *
			techModifier *
			infraModifier *
			stabilityModifier;
	}
	return total;
}
