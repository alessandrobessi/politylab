import { describe, it, expect } from 'vitest';
import { generateWorld } from '../src/lib/worldgen';
import { assertFiniteWorld } from '../src/lib/simulation/assert';

const SEED = 481204;

function contiguous(regionIds: string[], neighborsById: Map<string, string[]>): boolean {
	if (regionIds.length === 0) return true;
	const inState = new Set(regionIds);
	const seen = new Set<string>([regionIds[0]!]);
	const stack = [regionIds[0]!];
	while (stack.length) {
		const cur = stack.pop()!;
		for (const n of neighborsById.get(cur) ?? []) {
			if (inState.has(n) && !seen.has(n)) {
				seen.add(n);
				stack.push(n);
			}
		}
	}
	return seen.size === inState.size;
}

describe('generateWorld — determinism', () => {
	it('produces an identical world for the same seed', () => {
		expect(generateWorld(SEED)).toEqual(generateWorld(SEED));
	});

	it('produces a different world for a different seed', () => {
		const a = generateWorld(SEED);
		const b = generateWorld(SEED + 1);
		expect(a.states.map((s) => s.name)).not.toEqual(b.states.map((s) => s.name));
	});

	it('respects world-generation options deterministically', () => {
		const opts = { regionCount: 90, stateCount: 5 };
		const a = generateWorld(7, opts);
		expect(a.regions).toHaveLength(90);
		expect(a.states).toHaveLength(5);
		expect(generateWorld(7, opts)).toEqual(a);
	});
});

describe('generateWorld — structure', () => {
	const world = generateWorld(SEED);

	it('has 8 states and 160 regions', () => {
		expect(world.states).toHaveLength(8);
		expect(world.regions).toHaveLength(160);
	});

	it('satisfies every world invariant', () => {
		expect(() => assertFiniteWorld(world)).not.toThrow();
	});

	it('assigns every region to a state', () => {
		expect(world.regions.every((r) => r.ownerId !== null)).toBe(true);
	});

	it('gives each state a contiguous territory', () => {
		const neighborsById = new Map(world.regions.map((r) => [r.id, r.neighbors]));
		for (const state of world.states) {
			const owned = world.regions.filter((r) => r.ownerId === state.id).map((r) => r.id);
			expect(owned.length).toBeGreaterThan(0);
			expect(contiguous(owned, neighborsById)).toBe(true);
		}
	});

	it('has symmetric region adjacency', () => {
		const byId = new Map(world.regions.map((r) => [r.id, r]));
		for (const r of world.regions) {
			for (const n of r.neighbors) {
				expect(byId.get(n)?.neighbors).toContain(r.id);
			}
		}
	});

	it('gives every ordered pair of states a relation with matching proximity', () => {
		for (const a of world.states) {
			for (const b of world.states) {
				if (a === b) continue;
				const ab = a.relations[b.id];
				const ba = b.relations[a.id];
				expect(ab).toBeDefined();
				expect(ba).toBeDefined();
				expect(ab!.proximity).toBeCloseTo(ba!.proximity, 12);
			}
		}
	});

	it('assigns unique state names', () => {
		const names = world.states.map((s) => s.name);
		expect(new Set(names).size).toBe(names.length);
	});
});

describe('generateWorld — asymmetry and calibration (MODEL.md §5, §9, §76)', () => {
	const world = generateWorld(SEED);

	it('starts states with meaningfully different sizes', () => {
		const pops = world.states.map((s) => s.population).sort((a, b) => a - b);
		expect(pops[pops.length - 1]! / pops[0]!).toBeGreaterThan(1.5);
	});

	it('starts states with different structural conditions', () => {
		const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
		expect(spread(world.states.map((s) => s.education))).toBeGreaterThan(0.05);
		expect(spread(world.states.map((s) => s.politics.stability))).toBeGreaterThan(0.05);
		expect(spread(world.states.map((s) => s.technology.agriculture))).toBeGreaterThan(0.03);
	});

	it('keeps most states in the food-ratio band 0.9–1.35', () => {
		const inBand = world.states.filter((s) => s.foodRatio >= 0.9 && s.foodRatio <= 1.35);
		expect(inBand.length).toBeGreaterThanOrEqual(6);
	});

	it('produces population magnitudes in the MODEL.md §5 range across several seeds', () => {
		for (let seed = 0; seed < 12; seed++) {
			for (const s of generateWorld(seed).states) {
				expect(s.population).toBeGreaterThan(200_000);
				expect(s.population).toBeLessThan(12_000_000);
			}
		}
	});

	it('keeps different seeds numerically safe', () => {
		for (let seed = 100; seed < 115; seed++) {
			expect(() => generateWorld(seed)).not.toThrow();
		}
	});
});
