import type { World } from '../models/world';

/**
 * State-graph geometry (MODEL.md §47): which states border which, the hop
 * distance between every pair, and the proximity that distance implies. Shared
 * by world generation and the diplomacy system so both agree, and recomputed
 * each year because conquest changes the graph.
 */

/** Adjacency between states: A borders B if any region of A neighbours a region of B. */
export function stateAdjacency(world: World): Map<string, Set<string>> {
	const ownerOf = new Map<string, string | null>(world.regions.map((r) => [r.id, r.ownerId]));
	const adjacency = new Map<string, Set<string>>();
	for (const state of world.states) {
		if (state.alive) adjacency.set(state.id, new Set());
	}
	for (const region of world.regions) {
		const a = region.ownerId;
		if (a === null || !adjacency.has(a)) continue;
		for (const neighbourId of region.neighbors) {
			const b = ownerOf.get(neighbourId) ?? null;
			if (b !== null && b !== a && adjacency.has(b)) adjacency.get(a)!.add(b);
		}
	}
	return adjacency;
}

/** Breadth-first hop distance between every pair of states over `adjacency`. */
export function graphDistances(
	stateIds: readonly string[],
	adjacency: Map<string, Set<string>>
): Map<string, Map<string, number>> {
	const all = new Map<string, Map<string, number>>();
	for (const start of stateIds) {
		const dist = new Map<string, number>([[start, 0]]);
		let frontier = [start];
		while (frontier.length > 0) {
			const next: string[] = [];
			for (const node of frontier) {
				for (const neighbour of adjacency.get(node) ?? []) {
					if (!dist.has(neighbour)) {
						dist.set(neighbour, dist.get(node)! + 1);
						next.push(neighbour);
					}
				}
			}
			frontier = next;
		}
		all.set(start, dist);
	}
	return all;
}

/** proximity = exp(−0.7·(d−1)) for d ≥ 1; 1 for neighbours; 0 for unreachable (MODEL.md §47). */
export function proximityFromDistance(distance: number): number {
	if (!Number.isFinite(distance)) return 0;
	return distance <= 1 ? 1 : Math.exp(-0.7 * (distance - 1));
}
