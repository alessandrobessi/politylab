import type { SimulationConfig } from '../config';
import type { SimContext } from '../context';
import { CauseSet } from '../events/causes';
import { approach, clamp, clamp01, normalizeShares, safeDivide, sigmoid } from '../math';
import type { FactionInfluence, State } from '../models/state';
import type { World } from '../models/world';
import { classifyGovernment } from '../strategy/classify';
import { welfareEffect } from './common';

/**
 * Phase 7 — Political dynamics (BLUEPRINT.md §16–§17, §24; MODEL.md §28–§40).
 *
 * Per state: overextension (§38) → institutional capacity (§37) → faction
 * influence (§33) → inequality (§28) → participation gap & elite conflict
 * (§29, §34) → legitimacy (§29) → stability (§30). Then a probabilistic
 * government transition (§35–§36) may reshape the continuous political structure,
 * and the government-type label is re-derived (§32).
 *
 * Political stability is multicausal (MODEL.md P09) and transitions are
 * probabilistic and conditional (P10) — never a deterministic progression.
 */

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

/** A state's administrative capacity (MODEL.md §38). */
export function administrativeCapacity(state: State): number {
	return (
		state.population *
		(0.5 + state.politics.institutionalCapacity) *
		(0.5 + state.technology.transport)
	);
}

/**
 * Territorial overextension, 0..1 (MODEL.md §38): how much a state's share of
 * world territory outruns its share of world administrative capacity. Measured
 * against the living states' means so it is era-independent.
 */
export function computeOverextension(
	state: State,
	meanTerritory: number,
	meanAdminCapacity: number
): number {
	const territoryShare = safeDivide(state.territory, meanTerritory, 1);
	const capacityShare = safeDivide(administrativeCapacity(state), meanAdminCapacity, 1);
	const ratio = safeDivide(territoryShare, capacityShare, 1);
	return clamp01((ratio - 1) / 1.5);
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

/**
 * Regime stress (MODEL.md §30). `militaryBurdenStress` is the §43 political cost
 * of over-arming; `overextension` is §38's administrative strain.
 */
export function computeStress(
	inequality: number,
	foodStress: number,
	warExhaustion: number,
	economicStress: number,
	debtStress: number,
	eliteConflict: number,
	militaryBurdenStress = 0,
	overextension = 0
): number {
	return (
		0.2 * inequality +
		0.2 * foodStress +
		0.18 * warExhaustion +
		0.14 * economicStress +
		0.09 * debtStress +
		0.09 * eliteConflict +
		0.07 * militaryBurdenStress +
		0.1 * overextension
	);
}

/** Rupture pressure, 0..1 (MODEL.md §35). */
export function computeRupturePressure(
	stability: number,
	legitimacy: number,
	participationGap: number,
	eliteConflict: number
): number {
	return clamp01(
		0.45 * (1 - stability) + 0.3 * (1 - legitimacy) + 0.15 * participationGap + 0.1 * eliteConflict
	);
}

export type TransitionKind = 'reform' | 'coup' | 'revolution' | 'autocratization';

/** Relative likelihood of each transition kind on a rupture (MODEL.md §36). */
export function scoreTransitions(state: State): Record<TransitionKind, number> {
	const p = state.politics;
	const moderateInstitutions = clamp01(1 - Math.abs(p.institutionalCapacity - 0.5) * 2);
	return {
		reform:
			0.35 * state.education +
			0.3 * p.factions.merchant +
			0.2 * moderateInstitutions +
			0.15 * p.participationGap,
		coup:
			0.4 * p.factions.military + 0.35 * (1 - p.legitimacy) + 0.25 * (1 - p.institutionalCapacity),
		revolution:
			0.3 * (1 - p.legitimacy) +
			0.3 * p.factions.worker +
			0.2 * state.urbanization +
			0.2 * state.inequality,
		autocratization: 0.35 * (1 - p.stability) + 0.35 * p.centralization + 0.3 * p.factions.military
	};
}

function bump(obj: FactionInfluence, key: keyof FactionInfluence, delta: number): void {
	obj[key] = Math.max(0, obj[key] + delta);
}

/** Apply a transition's structural changes (MODEL.md §36). */
export function applyTransition(state: State, kind: TransitionKind): void {
	const p = state.politics;
	switch (kind) {
		case 'reform':
			p.politicalParticipation = clamp01(p.politicalParticipation + 0.15);
			p.ruleOfLaw = clamp01(p.ruleOfLaw + 0.1);
			p.centralization = clamp01(p.centralization - 0.05);
			p.legitimacy = clamp01(p.legitimacy + 0.05);
			p.institutionalCapacity = clamp01(p.institutionalCapacity + 0.03);
			break;
		case 'coup':
			p.politicalParticipation = clamp01(p.politicalParticipation - 0.2);
			p.centralization = clamp01(p.centralization + 0.15);
			p.ruleOfLaw = clamp01(p.ruleOfLaw - 0.1);
			p.legitimacy = clamp01(p.legitimacy - 0.05);
			p.stability = clamp01(p.stability - 0.1);
			p.hereditary = false;
			bump(p.factions, 'military', 0.2);
			break;
		case 'revolution':
			p.politicalParticipation = clamp01(p.politicalParticipation + 0.25);
			p.centralization = clamp01(p.centralization - 0.15);
			p.legitimacy = 0.5;
			p.stability = clamp01(p.stability - 0.2);
			p.institutionalCapacity = clamp01(p.institutionalCapacity - 0.1);
			p.hereditary = false;
			state.inequality = clamp(state.inequality - 0.1, 0.05, 0.95);
			bump(p.factions, 'worker', 0.2);
			bump(p.factions, 'elite', -0.15);
			break;
		case 'autocratization':
			p.politicalParticipation = clamp01(p.politicalParticipation - 0.25);
			p.centralization = clamp01(p.centralization + 0.2);
			p.ruleOfLaw = clamp01(p.ruleOfLaw - 0.15);
			p.legitimacy = clamp01(p.legitimacy + 0.03);
			p.stability = clamp01(p.stability + 0.05);
			break;
	}
	p.factions = normalizeShares(p.factions);
}

/** Faction influence drifts toward structural targets (MODEL.md §33). */
function updateFactions(state: State, config: SimulationConfig): void {
	const p = state.politics;
	const activeWar = state.warExhaustion > 0.05 ? 1 : 0;
	const targets = normalizeShares({
		elite: 0.2 + 0.4 * state.economy.agriculture,
		merchant: 0.1 + 0.35 * state.economy.services + 0.2 * state.tradeOpenness,
		military: 0.1 + 0.4 * state.military.burden + 0.15 * activeWar,
		worker: 0.05 + 0.4 * state.economy.industry * state.urbanization
	});
	const rate = config.politics.factionAdjustmentRate;
	for (const key of ['elite', 'merchant', 'military', 'worker'] as const) {
		p.factions[key] = approach(p.factions[key], targets[key], rate);
	}
	p.factions = normalizeShares(p.factions);
}

/** Institutional capacity evolves slowly (MODEL.md §37). Δ clamped to [-0.025, +0.020]. */
function updateInstitutionalCapacity(state: State): void {
	const p = state.politics;
	const administrationIntensity = safeDivide(state.spending.administration, state.gdp, 0);
	const delta =
		0.008 * (administrationIntensity / 0.03) +
		0.004 * state.education +
		0.004 * state.technology.institutions -
		0.006 * state.warExhaustion -
		0.006 * state.overextension;
	p.institutionalCapacity = clamp01(p.institutionalCapacity + clamp(delta, -0.025, 0.02));
}

export function updatePolitics(world: World, ctx: SimContext): void {
	const rng = ctx.rng.fork('politics');
	const cfg = ctx.config.politics;

	const living = world.states.filter((s) => s.alive);
	const n = Math.max(1, living.length);
	const meanTerritory = living.reduce((a, s) => a + s.territory, 0) / n;
	const meanAdminCapacity = living.reduce((a, s) => a + administrativeCapacity(s), 0) / n;

	for (const state of world.states) {
		if (!state.alive) continue;
		const p = state.politics;

		state.debtRatio = safeDivide(state.debt, Math.max(state.gdp, 1e-9), 0);
		state.debtStress = clamp01((state.debtRatio - 0.5) / 1.5);
		state.economicStress = clamp01(-state.growth.gdpPerCapita / 0.1);
		state.overextension = computeOverextension(state, meanTerritory, meanAdminCapacity);

		updateInstitutionalCapacity(state);
		updateFactions(state, ctx.config);

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

		// Stability (MODEL.md §30).
		const support = computeSupport(
			p.legitimacy,
			p.institutionalCapacity,
			state.prosperity,
			welfare
		);
		const militaryBurdenStress = clamp01((state.military.burden - 0.08) / 0.15);
		const stress = computeStress(
			state.inequality,
			state.foodStress,
			state.warExhaustion,
			state.economicStress,
			state.debtStress,
			p.eliteConflict,
			militaryBurdenStress,
			state.overextension
		);
		const targetStability = clamp01(0.5 + support - stress);
		p.stability = clamp01(
			approach(stabilityBefore, targetStability, cfg.stabilityAdjustmentRate) + rng.normal(0, 0.005)
		);

		// Government transition (MODEL.md §35–§36).
		const rupturePressure = computeRupturePressure(
			p.stability,
			p.legitimacy,
			p.participationGap,
			p.eliteConflict
		);
		const ruptureProbability = cfg.ruptureBaseProbability * sigmoid((rupturePressure - 0.65) * 10);
		if (rng.bool(ruptureProbability)) {
			const scores = scoreTransitions(state);
			const kinds: TransitionKind[] = ['reform', 'coup', 'revolution', 'autocratization'];
			const kind = rng.weighted(
				kinds,
				kinds.map((k) => Math.max(0.01, scores[k]))
			);
			applyTransition(state, kind);
			if (ctx.traces) {
				const cs = new CauseSet();
				cs.add('rupture_pressure', rupturePressure, rupturePressure);
				cs.add('instability', 0.45 * (1 - p.stability), p.stability);
				cs.add('illegitimacy', 0.3 * (1 - p.legitimacy), p.legitimacy);
				cs.add('elite_conflict', 0.1 * p.eliteConflict, p.eliteConflict);
				ctx.traces.record(state.id, `transition:${kind}`, cs.list());
			}
		}

		// Derived label (MODEL.md §32).
		p.governmentType = classifyGovernment(p);

		if (ctx.traces) {
			const stabilityCauses = new CauseSet();
			stabilityCauses.add('legitimacy', 0.3 * p.legitimacy, p.legitimacy);
			stabilityCauses.add('institutions', 0.25 * p.institutionalCapacity, p.institutionalCapacity);
			stabilityCauses.add('prosperity', 0.2 * state.prosperity, state.prosperity);
			stabilityCauses.add('welfare', 0.15 * welfare, welfare);
			stabilityCauses.add('inequality', -0.2 * state.inequality, state.inequality);
			stabilityCauses.add('food_stress', -0.2 * state.foodStress, state.foodStress);
			stabilityCauses.add('war_exhaustion', -0.18 * state.warExhaustion, state.warExhaustion);
			stabilityCauses.add('economic_stress', -0.14 * state.economicStress, state.economicStress);
			stabilityCauses.add('debt_stress', -0.09 * state.debtStress, state.debtStress);
			stabilityCauses.add('elite_conflict', -0.09 * p.eliteConflict, p.eliteConflict);
			stabilityCauses.add('overextension', -0.1 * state.overextension, state.overextension);
			stabilityCauses.add('military_burden', -0.07 * militaryBurdenStress, state.military.burden);
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
