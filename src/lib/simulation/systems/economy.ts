import type { SimContext } from '../context';
import { CauseSet } from '../events/causes';
import { clamp01, finiteOrFallback, safeDivide } from '../math';
import type { World } from '../models/world';
import { regionsByOwner, revenueFraction } from './common';
import { accumulateCapital, computeGdp, computeTfp } from './production';

/**
 * Phase 3 — Production (BLUEPRINT.md §12, §24; MODEL.md §12–§16).
 *
 * Each year, in order: total factor productivity → Cobb–Douglas GDP from the
 * (already updated) population and current capital → GDP per capita → prosperity
 * → government revenue → next-year capital. Population and the economy are
 * coupled: population is the labour input here, and prosperity feeds back into
 * births and mortality next tick (MODEL.md §7–§8).
 *
 * GDP growth is decomposed into productivity, capital, and labour contributions
 * for the "Why?" view (BLUEPRINT.md §31).
 */
export function updateProduction(world: World, ctx: SimContext): void {
	const owned = regionsByOwner(world);
	const alpha = ctx.config.economy.capitalElasticity;
	const halfSaturation = ctx.config.economy.prosperityHalfSaturation;

	for (const state of world.states) {
		if (!state.alive) continue;
		const regions = owned.get(state.id) ?? [];
		const meanInfrastructure = regions.length
			? regions.reduce((sum, r) => sum + r.infrastructure, 0) / regions.length
			: 0;

		const prevGdp = state.gdp;
		const prevGdpPerCapita = state.gdpPerCapita;
		const prevTfp = state.productivity;

		const tfp = computeTfp(
			state.technology,
			state.politics.institutionalCapacity,
			state.politics.stability,
			meanInfrastructure,
			state.tradeOpenness,
			ctx.config
		);
		const gdp = computeGdp(tfp, state.capital, state.population, alpha);
		const gdpPerCapita = safeDivide(gdp, state.population, 0);
		const prosperity = clamp01(gdpPerCapita / (gdpPerCapita + halfSaturation));

		const revenue = gdp * revenueFraction(state);
		const infrastructureInvestment = state.budget.infrastructure * revenue;
		const warCapitalDamage = 0; // milestone 16

		const nextCapital = finiteOrFallback(
			accumulateCapital(state.capital, gdp, infrastructureInvestment, warCapitalDamage, ctx.config),
			state.capital
		);

		const gdpGrowth = safeDivide(gdp - prevGdp, prevGdp, 0);
		const gdpPerCapitaGrowth = safeDivide(gdpPerCapita - prevGdpPerCapita, prevGdpPerCapita, 0);

		state.productivity = tfp;
		state.gdp = gdp;
		state.gdpPerCapita = gdpPerCapita;
		state.prosperity = prosperity;
		state.capital = nextCapital;
		state.growth.gdp = gdpGrowth;
		state.growth.gdpPerCapita = gdpPerCapitaGrowth;

		if (ctx.traces) {
			// Y = A·Kᵅ·L¹⁻ᵅ ⇒ growth ≈ Ȧ/A + α·K̇/K + (1−α)·L̇/L.
			const tfpContribution = safeDivide(tfp - prevTfp, prevTfp, 0);
			const labourContribution = (1 - alpha) * state.growth.population;
			const capitalContribution = gdpGrowth - tfpContribution - labourContribution;
			const causes = new CauseSet();
			causes.add('productivity', tfpContribution, tfp);
			causes.add('capital_investment', capitalContribution, nextCapital);
			causes.add('population', labourContribution, state.growth.population);
			ctx.traces.record(state.id, 'gdpGrowth', causes.list());
		}
	}
}
