import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYears } from '../engine';
import { makeTinyWorld } from '../testing/tiny-world';
import { resolveWarfare } from './warfare';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

/** A tiny world with an active attacker→defender war. */
function warWorld() {
	const world = makeTinyWorld();
	const [a, b] = [world.states[0]!, world.states[1]!];
	a.relations[b.id]!.atWar = b.relations[a.id]!.atWar = true;
	world.wars.push({
		id: 'war-0',
		attackerId: a.id,
		defenderId: b.id,
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
	return { world, a, b };
}

describe('resolveWarfare', () => {
	it('accrues war exhaustion for both belligerents and decays it in peace', () => {
		const { world, a, b } = warWorld();
		resolveWarfare(world, context({ year: 1 }));
		expect(a.warExhaustion).toBeGreaterThan(0);
		expect(b.warExhaustion).toBeGreaterThan(0);

		world.wars[0]!.active = false;
		a.relations[b.id]!.atWar = b.relations[a.id]!.atWar = false;
		const exhausted = a.warExhaustion;
		resolveWarfare(world, context({ year: 2 }));
		expect(a.warExhaustion).toBeCloseTo(exhausted * config.warfare.peaceExhaustionDecay, 9);
	});

	it('inflicts casualties (bounded to ≤3%/yr) and economic damage', () => {
		const { world, a } = warWorld();
		world.wars[0]!.intensity = 1;
		const popBefore = a.population;
		const capitalBefore = a.capital;
		resolveWarfare(world, context({ year: 1, rng: new SeededRandom(9) }));
		expect(a.population).toBeLessThan(popBefore);
		expect(a.population).toBeGreaterThan(popBefore * 0.97);
		expect(a.capital).toBeLessThan(capitalBefore);
	});

	it('always ends the war eventually, and never past ~a few decades', () => {
		const { world, a, b } = warWorld();
		let year = 0;
		while (world.wars[0]!.active && year < 300) {
			year++;
			resolveWarfare(world, context({ year, rng: new SeededRandom(year) }));
		}
		expect(world.wars[0]!.active).toBe(false);
		expect(year).toBeLessThan(60);
		expect(a.relations[b.id]!.atWar).toBe(false);
		expect(a.relations[b.id]!.warMemory).toBe(1);
	});

	it('a dominant attacker captures border regions; the defender loses that land', () => {
		const { world, a, b } = warWorld();
		a.military.power = 1e7; // overwhelming
		b.military.power = 1;
		world.wars[0]!.intensity = 1;
		const bTerritoryBefore = b.territory;
		for (let y = 1; y < 120 && b.alive && world.wars[0]!.regionsToAttacker.length === 0; y++) {
			if (!world.wars[0]!.active) {
				// A relentless aggressor renews the war.
				world.wars[0]!.active = true;
				a.relations[b.id]!.atWar = b.relations[a.id]!.atWar = true;
				a.warExhaustion = b.warExhaustion = 0;
			}
			resolveWarfare(world, context({ year: y, rng: new SeededRandom(y) }));
		}
		expect(world.wars[0]!.regionsToAttacker.length).toBeGreaterThan(0);
		expect(b.territory).toBeLessThan(bTerritoryBefore);
		if (!b.alive) expect(b.territory).toBe(0);
	});
});

describe('long-run warfare (MODEL.md §77–§78)', () => {
	it('wars occur and end, states can fall but no world conquest, world stays finite', () => {
		let conquest = 0;
		for (const seed of [1, 7, 42, 481204, 99, 2]) {
			const world = generateWorld(seed);
			simulateYears(world, 1000, { validate: true });

			expect(world.wars.length).toBeGreaterThan(20);
			const longest = Math.max(
				...world.wars.map((w) => (w.endYear ?? world.year) - w.startYear),
				0
			);
			expect(longest).toBeLessThan(150);
			expect(world.wars.filter((w) => w.active).length).toBeLessThan(5);

			const alive = world.states.filter((s) => s.alive);
			expect(alive.length).toBeGreaterThanOrEqual(1);
			const totalArea = world.regions.reduce((s, r) => s + r.area, 0);
			const biggest = Math.max(...alive.map((s) => s.territory)) / totalArea;
			if (biggest > 0.9) conquest++;

			// eliminated states keep their history but are inert
			for (const dead of world.states.filter((s) => !s.alive)) {
				expect(dead.territory).toBe(0);
				expect(world.regions.some((r) => r.ownerId === dead.id)).toBe(false);
			}
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
		expect(conquest).toBeLessThanOrEqual(1); // rare, not the rule (MODEL §78)
	});
});
