import type { SimContext } from '../context';
import { CauseSet } from '../events/causes';
import { approach, clamp, clamp01, safeDivide } from '../math';
import type { FactionInfluence } from '../models/state';
import type { World } from '../models/world';
import { welfareEffect } from './common';

/**
 * Phase 7 — Political dynamics (BLUEPRINT.md §16–§17, §24; MODEL.md §28–§34, §40).
 *
 * Derived stresses (economic §31, debt §40), then the year's updates:
 *   inequality (§28) → participation gap & elite conflict (§29, §34) →
 *   legitimacy (§29) → stability (§30, support − stress toward a target, with a
 *   small seeded disturbance).
 *
 * Political stability is multicausal (MODEL.md P09): no single variable decides
 * it. Government transitions are NOT modelled here — that is milestone 17.
 */

/** Desired political participation (MODEL.md §29). Shared with world generation. */
export function computeDesiredParticipation(
	education: number,
	urbanization: number,
	factions: FactionInfluence
): number {
	return clamp01(
		0.1 + 0.35 * education + 0.25 * urbanization + 0.15 * factions.merchant + 0.15 * factions.worker
	);
}

/** Elite conflict (MODEL.md §34). Shared with world generation. */
export function computeEliteConflict(
	participationGap: number,
	factions: FactionInfluence,
	inequality: number
): number {
	const polarization = clamp01(0.4 * participationGap + 0.3 * factions.military + 0.3 * inequality);
	const dominant = Math.max(factions.elite, factions.merchant, factions.military, factions.worker);
	return clamp01(polarization * (1 - dominant));
}

/** Regime support (MODEL.md §30). */
export function computeSupport(
	legitimacy: number,
	institutionalCapacity: number,
	prosperity: number,
	welfare: number,
	recentVictory = 0
): number {
	return (
		0.3 * legitimacy +
		0.25 * institutionalCapacity +
		0.2 * prosperity +
		0.15 * welfare +
		0.1 * recentVictory
	);
}

/** Regime stress (MODEL.md §30). */
export function computeStress(
	inequality: number,
	foodStress: number,
	warExhaustion: number,
	economicStress: number,
	debtStress: number,
	eliteConflict: number
): number {
	return (
		0.22 * inequality +
		0.22 * foodStress +
		0.2 * warExhaustion +
		0.16 * economicStress +
		0.1 * debtStress +
		0.1 * eliteConflict
	);
}

export function updatePolitics(world: World, ctx: SimContext): void {
	const rng = ctx.rng.fork('politics');
	const cfg = ctx.config.politics;

	for (const state of world.states) {
		if (!state.alive) continue;
		const p = state.politics;

		// Derived fiscal / economic stress inputs (MODEL.md §31, §40).
		state.debtRatio = safeDivide(state.debt, Math.max(state.gdp, 1e-9), 0);
		state.debtStress = clamp01((state.debtRatio - 0.5) / 1.5);
		state.economicStress = clamp01(-state.growth.gdpPerCapita / 0.1);

		// Participation gap (MODEL.md §29).
		const desiredParticipation = computeDesiredParticipation(
			state.education,
			state.urbanization,
			p.factions
		);
		p.participationGap = Math.max(0, desiredParticipation - p.politicalParticipation);

		// Inequality (MODEL.md §28). Clamped to [0.05, 0.95].
		const capitalPressure = clamp01(safeDivide(state.capital, state.gdp, 0) / 6);
		const rapidIndustrialization = clamp01(Math.max(0, state.growth.gdp) / 0.05);
		const welfare = welfareEffect(state, ctx.config);
		const deltaInequality =
			0.006 * capitalPressure +
			0.004 * rapidIndustrialization -
			0.01 * welfare -
			0.003 * p.institutionalCapacity +
			cfg.inequalityMeanReversion * (0.4 - state.inequality);
		state.inequality = clamp(state.inequality + deltaInequality, 0.05, 0.95);

		p.eliteConflict = computeEliteConflict(p.participationGap, p.factions, state.inequality);

		// Legitimacy (MODEL.md §29).
		const stabilityBefore = p.stability;
		const growthSignal = Math.tanh(state.growth.gdpPerCapita * 10);
		const deltaLegitimacy =
			0.012 * growthSignal +
			0.008 * stabilityBefore -
			0.02 * state.foodStress -
			0.015 * p.participationGap -
			0.015 * state.warExhaustion +
			cfg.legitimacyMeanReversion * (0.5 - p.legitimacy);
		p.legitimacy = clamp01(p.legitimacy + deltaLegitimacy);

		// Stability (MODEL.md §30): approach 0.50 + support − stress, then a
		// small seeded disturbance.
		const support = computeSupport(
			p.legitimacy,
			p.institutionalCapacity,
			state.prosperity,
			welfare
		);
		const stress = computeStress(
			state.inequality,
			state.foodStress,
			state.warExhaustion,
			state.economicStress,
			state.debtStress,
			p.eliteConflict
		);
		const targetStability = clamp01(0.5 + support - stress);
		p.stability = clamp01(
			approach(stabilityBefore, targetStability, cfg.stabilityAdjustmentRate) + rng.normal(0, 0.005)
		);

		if (ctx.traces) {
			const stabilityCauses = new CauseSet();
			stabilityCauses.add('legitimacy', 0.3 * p.legitimacy, p.legitimacy);
			stabilityCauses.add('institutions', 0.25 * p.institutionalCapacity, p.institutionalCapacity);
			stabilityCauses.add('prosperity', 0.2 * state.prosperity, state.prosperity);
			stabilityCauses.add('welfare', 0.15 * welfare, welfare);
			stabilityCauses.add('inequality', -0.22 * state.inequality, state.inequality);
			stabilityCauses.add('food_stress', -0.22 * state.foodStress, state.foodStress);
			stabilityCauses.add('war_exhaustion', -0.2 * state.warExhaustion, state.warExhaustion);
			stabilityCauses.add('economic_stress', -0.16 * state.economicStress, state.economicStress);
			stabilityCauses.add('debt_stress', -0.1 * state.debtStress, state.debtStress);
			stabilityCauses.add('elite_conflict', -0.1 * p.eliteConflict, p.eliteConflict);
			ctx.traces.record(state.id, 'stability', stabilityCauses.list());

			const legitimacyCauses = new CauseSet();
			legitimacyCauses.add('economic_growth', 0.012 * growthSignal, state.growth.gdpPerCapita);
			legitimacyCauses.add('stability', 0.008 * stabilityBefore, stabilityBefore);
			legitimacyCauses.add('food_stress', -0.02 * state.foodStress, state.foodStress);
			legitimacyCauses.add('participation_gap', -0.015 * p.participationGap, p.participationGap);
			legitimacyCauses.add('war_exhaustion', -0.015 * state.warExhaustion, state.warExhaustion);
			legitimacyCauses.add(
				'mean_reversion',
				cfg.legitimacyMeanReversion * (0.5 - p.legitimacy),
				p.legitimacy
			);
			ctx.traces.record(state.id, 'legitimacy', legitimacyCauses.list());
		}
	}
}
