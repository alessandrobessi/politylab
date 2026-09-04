import type { SimContext } from '../context';
import { CauseSet } from '../events/causes';
import { clamp, clamp01, safeDivide, sigmoid } from '../math';
import type { Region, TerrainType } from '../models/region';
import type { State } from '../models/state';
import type { War } from '../models/war';
import type { World } from '../models/world';
import { regionsByOwner } from './common';

/**
 * Phase 11 — Warfare (BLUEPRINT.md §22–§23, §24; MODEL.md §55–§63).
 *
 * No individual units. Each year of an active war:
 *   combat strength (power × readiness × seeded 0.9–1.1) → attacker success
 *   (`sigmoid(ln(ratio)·3)`, MODEL.md §57, with terrain defence) → casualties
 *   (≤3%/yr), economic damage, war exhaustion (§61) → probabilistic capture of a
 *   single border region (§60) → a peace check whose attractiveness rises with
 *   exhaustion, defeat, duration, and instability (§62). Victory/defeat move
 *   legitimacy by at most ±0.08 (§63). A state is removed only at territory 0.
 */

const TERRAIN_DEFENCE: Record<TerrainType, number> = {
	plains: 1.0,
	forest: 1.08,
	hills: 1.12,
	mountains: 1.25,
	desert: 1.05,
	coastal: 1.0
};

function combatStrength(state: State, rng: SimContext['rng']): number {
	return state.military.power * state.military.readiness * rng.range(0.9, 1.1);
}

function applyCasualties(state: State, ownedRegions: Region[], fraction: number): number {
	const before = state.population;
	const next = Math.max(1, before * (1 - fraction));
	const ratio = safeDivide(next, before, 1);
	for (const r of ownedRegions) r.population = Math.max(0, r.population * ratio);
	state.population = next;
	return before - next;
}

/** Defender regions that touch attacker territory — the front. */
function contestedRegions(
	attacker: State,
	defender: State,
	owned: Map<string, Region[]>
): Region[] {
	const attackerRegionIds = new Set((owned.get(attacker.id) ?? []).map((r) => r.id));
	return (owned.get(defender.id) ?? []).filter((r) =>
		r.neighbors.some((n) => attackerRegionIds.has(n))
	);
}

function transferRegion(
	world: World,
	region: Region,
	from: State,
	to: State,
	owned: Map<string, Region[]>
): void {
	const fromTerritoryBefore = from.territory || 1;
	region.ownerId = to.id;
	owned.set(
		from.id,
		(owned.get(from.id) ?? []).filter((r) => r.id !== region.id)
	);
	owned.set(to.id, [...(owned.get(to.id) ?? []), region]);

	from.territory = Math.max(0, from.territory - region.area);
	to.territory += region.area;
	from.population = Math.max(0, from.population - region.population);
	to.population += region.population;

	// Capital destruction proportional to the share of land lost (MODEL.md §59).
	from.capital = Math.max(
		0,
		from.capital - from.capital * (region.area / fromTerritoryBefore) * 0.5
	);

	// The former owner keeps a persistent claim (MODEL.md §51).
	const claim = from.relations[to.id];
	if (claim) claim.territorialClaims = clamp01(claim.territorialClaims + 0.4);

	if (from.territory <= 1e-9) eliminateState(world, from);
}

function eliminateState(world: World, state: State): void {
	state.alive = false;
	state.population = 0;
	state.territory = 0;
	for (const war of world.wars) {
		if (war.active && (war.attackerId === state.id || war.defenderId === state.id)) {
			war.active = false;
			war.endYear = world.year;
		}
	}
	for (const other of world.states) {
		const rel = other.relations[state.id];
		if (rel) rel.atWar = false;
	}
}

function peaceDesire(state: State, combatSuccess: number, duration: number): number {
	return clamp01(
		0.3 * state.warExhaustion +
			0.2 * (1 - combatSuccess) +
			0.15 * clamp01(duration / 15) +
			0.15 * (1 - state.politics.stability) +
			0.1 * state.debtStress +
			0.1 * state.economicStress
	);
}

function endWar(
	world: World,
	war: War,
	attacker: State | undefined,
	defender: State | undefined,
	year: number,
	ctx: SimContext
): void {
	war.active = false;
	war.endYear = year;
	const ab = attacker?.relations[war.defenderId];
	const ba = defender?.relations[war.attackerId];
	for (const rel of [ab, ba]) {
		if (!rel) continue;
		rel.atWar = false;
		rel.warMemory = 1;
		rel.lastWarEndYear = year;
		rel.rivalry = clamp01(rel.rivalry + 0.1);
	}

	// Victory / defeat (MODEL.md §63): net regions taken decides it.
	const net = war.regionsToAttacker.length - war.regionsToDefender.length;
	if (net !== 0 && attacker?.alive && defender?.alive) {
		const swing = Math.min(0.08, 0.02 + 0.015 * Math.abs(net));
		const winner = net > 0 ? attacker : defender;
		const loser = net > 0 ? defender : attacker;
		winner.politics.legitimacy = clamp01(winner.politics.legitimacy + swing);
		loser.politics.legitimacy = clamp01(loser.politics.legitimacy - swing);
		if (ctx.traces) {
			const cs = new CauseSet();
			cs.add('war_outcome', net > 0 ? swing : -swing, net);
			ctx.traces.record(winner.id, 'legitimacy_shock', cs.list());
		}
	}
}

export function resolveWarfare(world: World, ctx: SimContext): void {
	const rng = ctx.rng.fork('warfare');
	const owned = regionsByOwner(world);

	const belligerents = new Set<string>();

	for (const war of world.wars) {
		if (!war.active) continue;
		const attacker = world.states.find((s) => s.id === war.attackerId);
		const defender = world.states.find((s) => s.id === war.defenderId);
		if (!attacker?.alive || !defender?.alive) {
			endWar(world, war, attacker, defender, ctx.year, ctx);
			continue;
		}
		belligerents.add(attacker.id);
		belligerents.add(defender.id);

		war.intensity = Math.min(1, war.intensity + 0.05);
		const duration = ctx.year - war.startYear;

		const front = contestedRegions(attacker, defender, owned);
		war.contestedRegionIds = front.map((r) => r.id);
		if (front.length === 0) {
			// No shared front left — the war peters out.
			endWar(world, war, attacker, defender, ctx.year, ctx);
			continue;
		}
		const terrainDefence = front.reduce((s, r) => s + TERRAIN_DEFENCE[r.terrain], 0) / front.length;

		const attStr = combatStrength(attacker, rng);
		const defStr = combatStrength(defender, rng) * terrainDefence;
		const ratio = safeDivide(attStr, defStr, 1);
		const attackerSuccess = sigmoid(Math.log(Math.max(ratio, 1e-6)) * 3);

		for (const [side, success] of [
			[attacker, attackerSuccess],
			[defender, 1 - attackerSuccess]
		] as const) {
			const exposure = clamp(1 + (0.5 - success) * 1.5, 0.4, 2);
			const casualtyFraction = Math.min(
				0.03,
				ctx.config.military.baseCasualtyRate * war.intensity * exposure
			);
			applyCasualties(side, owned.get(side.id) ?? [], casualtyFraction);

			const economicDamageFraction = ctx.config.warfare.baseEconomicDamage * war.intensity;
			side.capital = Math.max(0, side.capital - economicDamageFraction * side.gdp);

			side.warExhaustion = clamp01(
				side.warExhaustion +
					0.015 +
					4 * casualtyFraction +
					1.5 * economicDamageFraction +
					0.01 * side.foodStress
			);
		}

		// Territorial capture (MODEL.md §60): sustained superiority, one region.
		// Capture threshold / rate raised in the post-v0.1 calibration pass — at
		// §60's original 0.65 / 0.25 wars almost never transferred enough land to
		// finish a state (extinction rate ≈ 4% over 1,000 y, below §77). See §92.
		if (attackerSuccess > 0.6) {
			const pCapture = clamp01((attackerSuccess - 0.6) / 0.4) * 0.34;
			if (rng.bool(pCapture) && front.length > 0) {
				const region = rng.pick(front);
				transferRegion(world, region, defender, attacker, owned);
				war.regionsToAttacker.push(region.id);
			}
		} else if (attackerSuccess < 0.4 && defender.alive) {
			const counter = contestedRegions(defender, attacker, owned);
			const pCapture = clamp01((0.4 - attackerSuccess) / 0.4) * 0.34;
			if (counter.length > 0 && rng.bool(pCapture)) {
				const region = rng.pick(counter);
				transferRegion(world, region, attacker, defender, owned);
				war.regionsToDefender.push(region.id);
			}
		}

		if (!attacker.alive || !defender.alive) {
			endWar(world, war, attacker, defender, ctx.year, ctx);
			continue;
		}

		// Peace (MODEL.md §62). Post-v0.1 calibration: weight the *mutual* desire to
		// stop far more heavily than either side's unilateral desire, so a side
		// that is decisively winning (low exhaustion, high success) can press the
		// advantage instead of the loser's desperation ending every war in ~2 y.
		const desireAtt = peaceDesire(attacker, attackerSuccess, duration);
		const desireDef = peaceDesire(defender, 1 - attackerSuccess, duration);
		const pPeace = clamp01(
			0.02 + 0.62 * Math.min(desireAtt, desireDef) + 0.26 * ((desireAtt + desireDef) / 2)
		);
		if (rng.bool(pPeace)) endWar(world, war, attacker, defender, ctx.year, ctx);
	}

	// Peace-time war-exhaustion decay (MODEL.md §61).
	for (const state of world.states) {
		if (state.alive && !belligerents.has(state.id)) {
			state.warExhaustion *= ctx.config.warfare.peaceExhaustionDecay;
		}
	}
}

/**
 * Phase 12 — Territorial changes (BLUEPRINT.md §24). Capture is applied during
 * phase 11; this pass keeps the derived territory totals consistent and removes
 * any state left with no land.
 */
export function applyTerritorialChanges(world: World, _ctx: SimContext): void {
	const owned = regionsByOwner(world);
	for (const state of world.states) {
		if (!state.alive) continue;
		const regions = owned.get(state.id) ?? [];
		state.territory = regions.reduce((s, r) => s + r.area, 0);
		if (state.territory <= 1e-9) eliminateState(world, state);
	}
}
