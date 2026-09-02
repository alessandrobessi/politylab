import { describe, it, expect } from 'vitest';
import { assertFiniteWorld, WorldInvariantError } from '../src/lib/simulation/assert';
import { allocateId } from '../src/lib/simulation/models/world';
import { createHistory } from '../src/lib/simulation/models/history';
import { sharesSumToOne } from '../src/lib/simulation/math';
import { makeTinyWorld } from '../src/lib/simulation/testing/tiny-world';

describe('makeTinyWorld fixture', () => {
	it('satisfies every world invariant', () => {
		expect(() => assertFiniteWorld(makeTinyWorld())).not.toThrow();
	});

	it('has 2 states and 10 regions split 5/5', () => {
		const world = makeTinyWorld();
		expect(world.states.map((s) => s.id)).toEqual(['ardan', 'velos']);
		expect(world.regions).toHaveLength(10);
		expect(world.regions.filter((r) => r.ownerId === 'ardan')).toHaveLength(5);
		expect(world.regions.filter((r) => r.ownerId === 'velos')).toHaveLength(5);
	});

	it('keeps budget, economy and faction shares summing to 1', () => {
		for (const s of makeTinyWorld().states) {
			expect(sharesSumToOne(Object.values(s.budget))).toBe(true);
			expect(sharesSumToOne([s.economy.agriculture, s.economy.industry, s.economy.services])).toBe(
				true
			);
			expect(sharesSumToOne(Object.values(s.politics.factions))).toBe(true);
		}
	});

	it('keeps normalized structural variables within [0, 1]', () => {
		for (const s of makeTinyWorld().states) {
			for (const v of [
				s.education,
				s.urbanization,
				s.inequality,
				s.prosperity,
				s.foodStress,
				s.taxRate,
				s.politics.legitimacy,
				s.politics.stability,
				...Object.values(s.technology)
			]) {
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(1);
			}
		}
	});

	it('has symmetric neighbor references among regions', () => {
		const world = makeTinyWorld();
		const byId = new Map(world.regions.map((r) => [r.id, r]));
		for (const r of world.regions) {
			for (const n of r.neighbors) {
				expect(byId.get(n)?.neighbors).toContain(r.id);
			}
		}
	});
});

describe('assertFiniteWorld catches violations', () => {
	it('rejects a non-finite population', () => {
		const world = makeTinyWorld();
		world.states[0]!.population = Number.NaN;
		expect(() => assertFiniteWorld(world)).toThrow(WorldInvariantError);
	});

	it('rejects a negative territory', () => {
		const world = makeTinyWorld();
		world.states[0]!.territory = -1;
		expect(() => assertFiniteWorld(world)).toThrow(/negative/);
	});

	it('rejects budget shares that no longer sum to 1', () => {
		const world = makeTinyWorld();
		world.states[0]!.budget.military += 0.2;
		expect(() => assertFiniteWorld(world)).toThrow(/budget shares do not sum to 1/);
	});

	it('rejects an out-of-range legitimacy', () => {
		const world = makeTinyWorld();
		world.states[1]!.politics.legitimacy = 1.4;
		expect(() => assertFiniteWorld(world)).toThrow(/legitimacy is out of \[0, 1\]/);
	});

	it('rejects a region owned by an unknown state', () => {
		const world = makeTinyWorld();
		world.regions[0]!.ownerId = 'nowhere';
		expect(() => assertFiniteWorld(world)).toThrow(/unknown state/);
	});

	it('rejects a relation to an unknown state', () => {
		const world = makeTinyWorld();
		world.states[0]!.relations['ghost'] = world.states[0]!.relations['velos']!;
		expect(() => assertFiniteWorld(world)).toThrow(/references unknown state/);
	});

	it('rejects a war referencing an unknown belligerent', () => {
		const world = makeTinyWorld();
		world.wars.push({
			id: 'w-0',
			attackerId: 'ardan',
			defenderId: 'ghost',
			attackerAllies: [],
			defenderAllies: [],
			startYear: 0,
			endYear: null,
			active: true,
			goal: 'limited-conquest',
			intensity: 0.5,
			contestedRegionIds: [],
			regionsToAttacker: [],
			regionsToDefender: []
		});
		expect(() => assertFiniteWorld(world)).toThrow(/defenderId references unknown state/);
	});
});

describe('helpers', () => {
	it('allocateId issues monotonic prefixed ids', () => {
		const world = makeTinyWorld();
		expect(allocateId(world, 'evt')).toBe('evt-0');
		expect(allocateId(world, 'evt')).toBe('evt-1');
		expect(allocateId(world, 'war')).toBe('war-2');
		expect(world.nextId).toBe(3);
	});

	it('createHistory starts empty', () => {
		expect(createHistory()).toEqual({ byState: {}, snapshots: [] });
	});
});
