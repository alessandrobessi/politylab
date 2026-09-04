import type { SimulationConfig } from '../config';
import type { SimContext } from '../context';
import { CauseSet } from '../events/causes';
import { clamp01, normalizeShares, safeDivide, sigmoid } from '../math';
import type { Region } from '../models/region';
import type { State, StrategicAction } from '../models/state';
import { allocateId, type World } from '../models/world';
import { regionsByOwner } from '../systems/common';
import { stateAdjacency } from '../systems/geography';
import { technologyIndex } from '../systems/technology';
import { scoreWarTarget, type WarTargetInputs } from './scoring';

/**
 * Phase 10 — Strategic decisions (BLUEPRINT.md §20–§21, §24; MODEL.md §51–§53).
 *
 * Two independent processes:
 *  1. Each state scores a menu of peaceful actions and picks one probabilistically
 *     (not argmax, MODEL.md §20), nudging its budget or relations.
 *  2. Every adjacent, non-allied, non-belligerent pair rolls MODEL.md §53's war
 *     probability from the §52 war-utility score. On success a war is declared
 *     (combat, casualties and territory are milestone 16).
 */

const PEACEFUL_ACTIONS = [
	'invest-economy',
	'invest-education',
	'invest-research',
	'increase-military',
	'seek-trade',
	'improve-relations'
] as const satisfies readonly StrategicAction[];

function shiftBudget(state: State, line: keyof State['budget'], amount: number): void {
	const b = { ...state.budget };
	b[line] = Math.max(0.02, b[line] + amount);
	b.administration = Math.max(0.02, b.administration - amount);
	state.budget = normalizeShares(b);
}

function maxNeighbourThreat(state: State): number {
	let max = 0;
	for (const rel of Object.values(state.relations)) max = Math.max(max, rel.threatPerception);
	return max;
}

/** Pick a peaceful action to pursue this year, or `null` if nothing is pressing. */
function pickPeacefulAction(state: State, rng: SimContext['rng']): StrategicAction | null {
	const scores: Record<(typeof PEACEFUL_ACTIONS)[number], number> = {
		'invest-economy': clamp01(0.4 - state.growth.gdpPerCapita * 8),
		'invest-education': clamp01(0.75 - state.education) * state.politics.institutionalCapacity,
		'invest-research': clamp01(0.8 - technologyIndex(state.technology)),
		'increase-military': clamp01((maxNeighbourThreat(state) - 0.35) * 2),
		'seek-trade': clamp01(0.6 - state.tradeOpenness),
		'improve-relations': clamp01(maxNeighbourThreat(state) - 0.3)
	};
	// Only act on a genuine need; otherwise keep the current allocation.
	if (Math.max(...Object.values(scores)) < 0.35) return null;
	const weights = PEACEFUL_ACTIONS.map((a) => scores[a] ** 2 + 0.02);
	return rng.weighted(PEACEFUL_ACTIONS, weights);
}

function applyPeacefulAction(state: State, action: StrategicAction): void {
	switch (action) {
		case 'invest-economy':
			shiftBudget(state, 'infrastructure', 0.02);
			break;
		case 'invest-education':
			shiftBudget(state, 'education', 0.02);
			break;
		case 'invest-research':
			shiftBudget(state, 'research', 0.02);
			break;
		case 'increase-military':
			shiftBudget(state, 'military', 0.02);
			break;
		case 'seek-trade':
		case 'improve-relations': {
			// Nudge opinion toward the most-feared neighbour (feeds M11/M12/M13).
			let worst: string | null = null;
			let worstThreat = -1;
			for (const [id, rel] of Object.entries(state.relations)) {
				if (rel.threatPerception > worstThreat) {
					worstThreat = rel.threatPerception;
					worst = id;
				}
			}
			if (worst) {
				const rel = state.relations[worst]!;
				rel.opinion = Math.min(1, rel.opinion + 0.01);
			}
			break;
		}
	}
}

/** Attacker `a` evaluating war against defender `b`. */
function warUtility(
	a: State,
	b: State,
	world: World,
	regionsOf: Map<string, Region[]>
): { utility: number; inputs: WarTargetInputs } {
	const rel = a.relations[b.id]!;

	const bRegions = regionsOf.get(b.id) ?? [];
	const borderRegions = bRegions; // v0.1: any of the target's land is a potential objective
	const meanAgri = borderRegions.length
		? borderRegions.reduce((s, r) => s + r.agriculturalPotential, 0) / borderRegions.length
		: 0;
	const meanResources = borderRegions.length
		? borderRegions.reduce(
				(s, r) =>
					s + (r.resources.iron + r.resources.coal + r.resources.oil + r.resources.minerals) / 4,
				0
			) / borderRegions.length
		: 0;

	const alliedPower = world.states
		.filter((s) => s.alive && s.id !== b.id && b.relations[s.id]?.alliance)
		.reduce((s, ally) => s + ally.military.power, 0);
	const defenderPower = b.military.power + 0.6 * alliedPower;
	const advantage = clamp01(safeDivide(a.military.power, a.military.power + defenderPower, 0.5));

	const inputs: WarTargetInputs = {
		territorialValue: clamp01(0.15 + 0.6 * meanAgri),
		resourceValue: clamp01(0.7 * meanResources),
		strategicValue: clamp01(0.3 * rel.proximity + 0.5 * rel.borderTension),
		claimValue: rel.territorialClaims,
		domesticPoliticalBenefit: clamp01(
			(0.55 - a.politics.stability) * 0.7 + (0.5 - a.politics.legitimacy) * 0.5
		),
		perceivedMilitaryAdvantage: advantage,
		rivalry: rel.rivalry,
		militaryRisk: 1 - advantage,
		allianceRisk: clamp01(safeDivide(alliedPower, Math.max(a.military.power, 1), 0)),
		economicCost: clamp01(0.3 + 0.5 * rel.trade + 0.2 * a.debtStress),
		warExhaustion: a.warExhaustion,
		tradeDependency: rel.trade
	};
	return { utility: scoreWarTarget(inputs), inputs };
}

function declareWar(world: World, attacker: State, defender: State, year: number): void {
	world.wars.push({
		id: allocateId(world, 'war'),
		attackerId: attacker.id,
		defenderId: defender.id,
		attackerAllies: [],
		defenderAllies: [],
		startYear: year,
		endYear: null,
		active: true,
		goal: 'limited-conquest',
		intensity: 0.5,
		contestedRegionIds: [],
		regionsToAttacker: [],
		regionsToDefender: []
	});
	const ab = attacker.relations[defender.id];
	const ba = defender.relations[attacker.id];
	if (ab) {
		ab.atWar = true;
		ab.alliance = false;
		ab.allianceSince = null;
	}
	if (ba) {
		ba.atWar = true;
		ba.alliance = false;
		ba.allianceSince = null;
	}
}

export function makeStrategicDecisions(world: World, ctx: SimContext): void {
	const rng = ctx.rng.fork('decisions');
	const living = world.states.filter((s) => s.alive);

	for (const state of living) {
		const action = pickPeacefulAction(state, rng);
		if (action) applyPeacefulAction(state, action);
	}

	const adjacency = stateAdjacency(world);
	const regionsOf = regionsByOwner(world);
	const cfg: SimulationConfig['warfare'] = ctx.config.warfare;

	for (const a of living) {
		for (const b of living) {
			if (a === b) continue;
			const rel = a.relations[b.id];
			if (!rel || rel.atWar || rel.alliance) continue;
			if (!adjacency.get(a.id)?.has(b.id)) continue; // no strategic access (MODEL.md §53)

			const { utility, inputs } = warUtility(a, b, world, regionsOf);

			// Soft restrictions (MODEL.md §53): scale the probability down rather
			// than an outright ban.
			const stabilityGate = clamp01(a.politics.stability / 0.2);
			const militaryGate = clamp01(inputs.perceivedMilitaryAdvantage / 0.25);
			const overextensionGate = clamp01((1 - a.overextension) / 0.5);
			// Recent belligerents are war-weary and slow to re-open hostilities.
			const memoryGate = 1 - 0.85 * rel.warMemory;
			const gates = stabilityGate * militaryGate * overextensionGate * memoryGate;

			const pWar =
				cfg.baseWarProbability * sigmoid((utility - cfg.warThreshold) * 8) * clamp01(gates);

			if (rng.bool(pWar)) {
				declareWar(world, a, b, ctx.year);
				if (ctx.traces) {
					const causes = new CauseSet();
					causes.add('territorial_value', 0.22 * inputs.territorialValue, inputs.territorialValue);
					causes.add('claim', 0.18 * inputs.claimValue, inputs.claimValue);
					causes.add('resource_value', 0.16 * inputs.resourceValue, inputs.resourceValue);
					causes.add(
						'military_advantage',
						0.1 * inputs.perceivedMilitaryAdvantage,
						inputs.perceivedMilitaryAdvantage
					);
					causes.add('rivalry', 0.1 * inputs.rivalry, inputs.rivalry);
					causes.add(
						'domestic_benefit',
						0.1 * inputs.domesticPoliticalBenefit,
						inputs.domesticPoliticalBenefit
					);
					causes.add('military_risk', -0.25 * inputs.militaryRisk, inputs.militaryRisk);
					causes.add('alliance_risk', -0.2 * inputs.allianceRisk, inputs.allianceRisk);
					causes.add('economic_cost', -0.15 * inputs.economicCost, inputs.economicCost);
					causes.add('trade_dependency', -0.1 * inputs.tradeDependency, inputs.tradeDependency);
					ctx.traces.record(a.id, `war:${b.id}`, causes.list());
				}
			}
		}
	}
}
