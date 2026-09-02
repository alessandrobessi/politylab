import type { SimulationConfig } from '../config';
import { clamp01 } from '../math';
import type { TechnologyState } from '../models/state';

/**
 * The economic production model (MODEL.md §13–§15). Shared by world generation
 * and the economy system so their starting and running values agree.
 */

/** Productive-technology composite index (MODEL.md §14). */
export function productiveTech(technology: TechnologyState): number {
	return (
		0.2 * technology.agriculture +
		0.15 * technology.materials +
		0.2 * technology.energy +
		0.2 * technology.transport +
		0.1 * technology.communication +
		0.15 * technology.institutions
	);
}

/**
 * Total factor productivity (MODEL.md §14): the product of technology,
 * institution, stability, infrastructure, and trade modifiers. The trade bonus
 * is capped at `config.economy.maxTradeProductivityBonus` (MODEL.md §27).
 */
export function computeTfp(
	technology: TechnologyState,
	institutionalCapacity: number,
	stability: number,
	meanInfrastructure: number,
	tradeOpenness: number,
	config: SimulationConfig
): number {
	const technologyModifier = 0.6 + 1.4 * productiveTech(technology);
	const institutionModifier = 0.7 + 0.6 * institutionalCapacity;
	const stabilityModifier = 0.7 + 0.3 * stability;
	const infrastructureModifier = 0.75 + 0.5 * meanInfrastructure;
	const tradeModifier = 1 + config.economy.maxTradeProductivityBonus * clamp01(tradeOpenness);
	return (
		technologyModifier *
		institutionModifier *
		stabilityModifier *
		infrastructureModifier *
		tradeModifier
	);
}

/** Cobb–Douglas output Y = A·Kᵅ·L¹⁻ᵅ (MODEL.md §13). */
export function computeGdp(
	tfp: number,
	capital: number,
	population: number,
	alpha: number
): number {
	return tfp * Math.max(capital, 0) ** alpha * Math.max(population, 0) ** (1 - alpha);
}

/**
 * Capital next year (MODEL.md §15):
 *   K' = K + s·Y + G_infra − δ·K − D_war
 * Never negative.
 */
export function accumulateCapital(
	capital: number,
	gdp: number,
	infrastructureInvestment: number,
	warCapitalDamage: number,
	config: SimulationConfig
): number {
	const next =
		capital +
		config.economy.privateInvestmentRate * gdp +
		infrastructureInvestment -
		config.economy.capitalDepreciation * capital -
		warCapitalDamage;
	return Math.max(0, next);
}
