import type { SimContext } from '../context';
import { clamp01 } from '../math';
import type { War } from '../models/war';
import type { World } from '../models/world';

/**
 * Phase 11 — Warfare (BLUEPRINT.md §22–§23, §24; MODEL.md §55–§63).
 *
 * Milestone 15 provides only a minimal placeholder: active wars accrue war
 * exhaustion (MODEL.md §61 base term) and end probabilistically after a few
 * years, war exhaustion decays during peace (§61). Annual combat, casualties,
 * economic damage, and territory transfer are milestone 16.
 */

function endWar(world: World, war: War, year: number): void {
	war.active = false;
	war.endYear = year;
	const a = world.states.find((s) => s.id === war.attackerId);
	const b = world.states.find((s) => s.id === war.defenderId);
	const ab = a?.relations[war.defenderId];
	const ba = b?.relations[war.attackerId];
	for (const rel of [ab, ba]) {
		if (!rel) continue;
		rel.atWar = false;
		rel.warMemory = 1;
		rel.lastWarEndYear = year;
	}
}

export function resolveWarfare(world: World, ctx: SimContext): void {
	const rng = ctx.rng.fork('warfare');
	const belligerents = new Set<string>();

	for (const war of world.wars) {
		if (!war.active) continue;
		const attacker = world.states.find((s) => s.id === war.attackerId);
		const defender = world.states.find((s) => s.id === war.defenderId);
		if (!attacker?.alive || !defender?.alive) {
			endWar(world, war, ctx.year);
			continue;
		}
		belligerents.add(attacker.id);
		belligerents.add(defender.id);

		// MODEL.md §61 base exhaustion accrual (casualty / damage terms in M16).
		attacker.warExhaustion = clamp01(attacker.warExhaustion + 0.015);
		defender.warExhaustion = clamp01(defender.warExhaustion + 0.015);

		const duration = ctx.year - war.startYear;
		const pEnd = clamp01(
			0.1 + 0.05 * duration + 0.4 * Math.max(attacker.warExhaustion, defender.warExhaustion)
		);
		if (rng.bool(pEnd)) endWar(world, war, ctx.year);
	}

	// Peace-time exhaustion decay (MODEL.md §61).
	for (const state of world.states) {
		if (state.alive && !belligerents.has(state.id)) {
			state.warExhaustion *= ctx.config.warfare.peaceExhaustionDecay;
		}
	}
}

/**
 * Phase 12 — Territorial changes (BLUEPRINT.md §24; MODEL.md §60). Milestone 16.
 */
export function applyTerritorialChanges(_world: World, _ctx: SimContext): void {}
