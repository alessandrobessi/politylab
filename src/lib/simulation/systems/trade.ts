import type { SimContext } from '../context';
import { clamp01, sigmoid } from '../math';
import type { RegionResources } from '../models/region';
import type { State } from '../models/state';
import type { World } from '../models/world';
import { regionsByOwner } from './common';

/**
 * Phase 8 — Trade (BLUEPRINT.md §12, §24; MODEL.md §26–§27).
 *
 * Bilateral trade intensity moves gradually toward a target set by a transparent
 * score (economic development, proximity, relations, resource complementarity,
 * transport). War between two states forces their trade to zero. Trade then
 * raises output (a capped TFP bonus, applied by the economy system via
 * `tradeOpenness`), improves relations (the diplomacy system reads `trade`), and
 * speeds technology diffusion (the technology system reads `trade`).
 *
 * Trade is symmetric: both directions of a pair hold the same value.
 */

const RESOURCE_KEYS = ['iron', 'coal', 'oil', 'minerals', 'genericResources'] as const;

/** Transparent trade score in ~[0, 1] (MODEL.md §26). */
export function computeTradeScore(
	prosperityA: number,
	prosperityB: number,
	proximity: number,
	averageOpinion: number,
	resourcesA: RegionResources,
	resourcesB: RegionResources,
	transportA: number,
	transportB: number,
	infrastructureA: number,
	infrastructureB: number
): number {
	// Product (not geometric mean): both economies must have surplus to trade,
	// and an undeveloped partner drags the score down sharply.
	const economicCompatibility = clamp01(prosperityA) * clamp01(prosperityB);
	const relationQuality = clamp01((averageOpinion + 1) / 2);
	const resourceComplementarity = clamp01(
		RESOURCE_KEYS.reduce((sum, k) => sum + Math.abs(resourcesA[k] - resourcesB[k]), 0) /
			RESOURCE_KEYS.length /
			0.25
	);
	const transportCompatibility =
		0.5 * ((transportA + transportB) / 2) + 0.5 * ((infrastructureA + infrastructureB) / 2);

	return (
		0.3 * economicCompatibility +
		0.25 * proximity +
		0.2 * relationQuality +
		0.15 * resourceComplementarity +
		0.1 * transportCompatibility
	);
}

/** Aggregate openness to trade — mean partner trade intensity, normalized (MODEL.md §27). */
export function computeTradeOpenness(state: State, living: readonly State[]): number {
	const partners = living.filter((o) => o.id !== state.id);
	if (partners.length === 0) return 0;
	const meanTrade =
		partners.reduce((sum, o) => sum + (state.relations[o.id]?.trade ?? 0), 0) / partners.length;
	return clamp01(meanTrade / 0.4);
}

function meanResources(regions: { resources: RegionResources }[]): RegionResources {
	const n = Math.max(1, regions.length);
	const acc: RegionResources = { iron: 0, coal: 0, oil: 0, minerals: 0, genericResources: 0 };
	for (const r of regions) {
		for (const k of RESOURCE_KEYS) acc[k] += r.resources[k];
	}
	for (const k of RESOURCE_KEYS) acc[k] /= n;
	return acc;
}

export function updateTrade(world: World, _ctx: SimContext): void {
	const living = world.states.filter((s) => s.alive);
	const owned = regionsByOwner(world);

	const resources = new Map<string, RegionResources>();
	const meanInfra = new Map<string, number>();
	for (const s of living) {
		const regions = owned.get(s.id) ?? [];
		resources.set(s.id, meanResources(regions));
		meanInfra.set(
			s.id,
			regions.length ? regions.reduce((sum, r) => sum + r.infrastructure, 0) / regions.length : 0
		);
	}

	for (let i = 0; i < living.length; i++) {
		for (let j = i + 1; j < living.length; j++) {
			const a = living[i]!;
			const b = living[j]!;
			const relAB = a.relations[b.id];
			const relBA = b.relations[a.id];
			if (!relAB || !relBA) continue;

			const score = computeTradeScore(
				a.prosperity,
				b.prosperity,
				relAB.proximity,
				(relAB.opinion + relBA.opinion) / 2,
				resources.get(a.id)!,
				resources.get(b.id)!,
				a.technology.transport,
				b.technology.transport,
				meanInfra.get(a.id)!,
				meanInfra.get(b.id)!
			);
			const target = relAB.atWar ? 0 : sigmoid((score - 0.5) * 6);
			const next = clamp01(relAB.trade + 0.15 * (target - relAB.trade));
			relAB.trade = next;
			relBA.trade = next;
		}
	}

	for (const s of living) {
		s.tradeOpenness = computeTradeOpenness(s, living);
	}
}
