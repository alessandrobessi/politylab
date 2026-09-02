import type { SimContext } from '../context';
import { CauseSet } from '../events/causes';
import { clamp, clamp01, safeDivide } from '../math';
import type { State } from '../models/state';
import type { World } from '../models/world';
import { graphDistances, proximityFromDistance, stateAdjacency } from './geography';

/**
 * Phase 9 — Diplomacy (BLUEPRINT.md §18–§19, §24; MODEL.md §44–§48).
 *
 * Every year, for every ordered pair of living states:
 *   proximity (§47, from the current border graph) → opinion (§44, slow drift to
 *   a structural equilibrium via mean reversion) → trust (§45, slower still) →
 *   threat perception (§48, relative power × proximity × hostility). War memory
 *   (§46) and territorial claims (§51) decay.
 *
 * `commonEnemy` (a shared high-threat third party) is the seed of
 * balance-of-power behaviour that alliances (M13) build on. Trade and alliance
 * flags are read here but changed by M12/M13; military power is still the
 * world-gen value until M14.
 */

export interface OpinionInputs {
	opinion: number;
	trade: number;
	alliance: boolean;
	commonEnemy: number;
	territorialClaims: number;
	threatPerception: number;
	rivalry: number;
	warMemory: number;
}

/** Annual change in opinion (MODEL.md §44), including mean reversion. */
export function computeOpinionDelta(i: OpinionInputs, meanReversion: number): number {
	return (
		0.02 * i.trade +
		0.015 * (i.alliance ? 1 : 0) +
		0.01 * i.commonEnemy -
		0.025 * i.territorialClaims -
		0.02 * i.threatPerception -
		0.015 * i.rivalry -
		0.02 * i.warMemory -
		meanReversion * i.opinion
	);
}

/**
 * Trust changes more slowly than opinion (MODEL.md §45). Positive drivers
 * (trade, alliance, long peace) scale by `(1 − trust)` and negative drivers
 * (war, claims, threat) by `trust`, giving a stable relationship-quality
 * equilibrium in (0, 1). No formula is given in MODEL.md; see §92.
 */
export function computeTrustDelta(
	trust: number,
	trade: number,
	alliance: boolean,
	peaceFactor: number,
	atWar: boolean,
	territorialClaims: number,
	threatPerception: number
): number {
	const rise = (0.006 * trade + 0.004 * (alliance ? 1 : 0) + 0.003 * peaceFactor) * (1 - trust);
	const fall =
		(0.01 * (atWar ? 1 : 0) + 0.006 * territorialClaims + 0.004 * threatPerception) * trust;
	return rise - fall;
}

/** Threat state i perceives from state j (MODEL.md §48). */
export function computeThreatPerception(
	ownPower: number,
	otherPower: number,
	opinion: number,
	proximity: number,
	expansionismSignal: number
): number {
	const relativePower = safeDivide(otherPower, ownPower + otherPower, 0.5);
	const hostility = clamp01((-opinion + 1) / 2);
	return clamp01(
		relativePower * proximity * (0.5 + 0.5 * hostility) * (0.75 + 0.25 * expansionismSignal)
	);
}

/** max over third parties k of min(threat a→k, threat b→k) — a shared adversary. */
function commonEnemyStrength(living: readonly State[], a: State, b: State): number {
	let best = 0;
	for (const k of living) {
		if (k === a || k === b) continue;
		const relA = a.relations[k.id];
		const relB = b.relations[k.id];
		if (!relA || !relB) continue;
		best = Math.max(best, Math.min(relA.threatPerception, relB.threatPerception));
	}
	return best;
}

export function updateDiplomacy(world: World, ctx: SimContext): void {
	const cfg = ctx.config.diplomacy;
	const living = world.states.filter((s) => s.alive);
	const distances = graphDistances(
		living.map((s) => s.id),
		stateAdjacency(world)
	);

	for (const a of living) {
		for (const b of living) {
			if (a === b) continue;
			const rel = a.relations[b.id];
			if (!rel) continue;

			rel.proximity = proximityFromDistance(distances.get(a.id)?.get(b.id) ?? Infinity);

			const commonEnemy = commonEnemyStrength(living, a, b);
			const opinionDelta = computeOpinionDelta(
				{
					opinion: rel.opinion,
					trade: rel.trade,
					alliance: rel.alliance,
					commonEnemy,
					territorialClaims: rel.territorialClaims,
					threatPerception: rel.threatPerception,
					rivalry: rel.rivalry,
					warMemory: rel.warMemory
				},
				cfg.opinionMeanReversion
			);
			rel.opinion = clamp(rel.opinion + opinionDelta, -1, 1);

			const peaceFactor =
				rel.lastWarEndYear === null ? 1 : clamp01((ctx.year - rel.lastWarEndYear) / 30);
			rel.trust = clamp01(
				rel.trust +
					computeTrustDelta(
						rel.trust,
						rel.trade,
						rel.alliance,
						peaceFactor,
						rel.atWar,
						rel.territorialClaims,
						rel.threatPerception
					)
			);

			const expansionismSignal = b.relations[a.id]?.territorialClaims ?? 0;
			rel.threatPerception = computeThreatPerception(
				a.military.power,
				b.military.power,
				rel.opinion,
				rel.proximity,
				expansionismSignal
			);

			rel.warMemory *= cfg.warMemoryDecay;
			rel.territorialClaims *= cfg.claimDecay;

			if (ctx.traces) {
				const causes = new CauseSet();
				causes.add('trade', 0.02 * rel.trade, rel.trade);
				causes.add('common_enemy', 0.01 * commonEnemy, commonEnemy);
				causes.add('territorial_claims', -0.025 * rel.territorialClaims, rel.territorialClaims);
				causes.add('threat', -0.02 * rel.threatPerception, rel.threatPerception);
				causes.add('rivalry', -0.015 * rel.rivalry, rel.rivalry);
				causes.add('war_memory', -0.02 * rel.warMemory, rel.warMemory);
				ctx.traces.record(a.id, `opinion:${b.id}`, causes.list());
			}
		}
	}
}
