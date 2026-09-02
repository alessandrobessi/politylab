import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { TraceSink } from '../trace';
import { makeTinyWorld } from '../testing/tiny-world';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYears } from '../engine';
import {
	computeBirthRate,
	computeNormalDeathRate,
	computeFamineMortality,
	updatePopulation
} from './population';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return {
		config,
		rng: new SeededRandom(1),
		year: 0,
		history: null,
		traces: null,
		...overrides
	};
}

describe('birth rate (MODEL.md §7)', () => {
	it('falls with education, urbanization and prosperity', () => {
		const base = computeBirthRate(0, 0, 0, config);
		expect(computeBirthRate(0.8, 0, 0, config)).toBeLessThan(base);
		expect(computeBirthRate(0, 0.8, 0, config)).toBeLessThan(base);
		expect(computeBirthRate(0, 0, 0.8, config)).toBeLessThan(base);
	});

	it('stays within [0.008, 0.040]', () => {
		expect(computeBirthRate(1, 1, 1, config)).toBeGreaterThanOrEqual(0.008);
		expect(computeBirthRate(-5, -5, -5, config)).toBeLessThanOrEqual(0.04);
	});
});

describe('death rate (MODEL.md §8, §11)', () => {
	it('higher medicine technology reduces normal mortality', () => {
		const low = computeNormalDeathRate(0.1, 0.3, 0.3, config);
		const high = computeNormalDeathRate(0.9, 0.3, 0.3, config);
		expect(high).toBeLessThan(low);
	});

	it('prosperity and welfare reduce normal mortality', () => {
		const base = computeNormalDeathRate(0.3, 0, 0, config);
		expect(computeNormalDeathRate(0.3, 0.8, 0, config)).toBeLessThan(base);
		expect(computeNormalDeathRate(0.3, 0, 0.8, config)).toBeLessThan(base);
	});

	it('normal mortality stays within [0.006, 0.040]', () => {
		expect(computeNormalDeathRate(1, 1, 1, config)).toBeGreaterThanOrEqual(0.006);
		expect(computeNormalDeathRate(-9, -9, -9, config)).toBeLessThanOrEqual(0.04);
	});

	it('famine mortality rises with food stress, quadratically, and is 0 at no stress', () => {
		expect(computeFamineMortality(0, config)).toBe(0);
		const mild = computeFamineMortality(0.3, config);
		const severe = computeFamineMortality(0.6, config);
		expect(severe).toBeGreaterThan(mild);
		// quadratic: doubling stress roughly quadruples the effect
		expect(severe / mild).toBeCloseTo(4, 1);
	});

	it('famine can push total mortality above the normal cap', () => {
		const normal = computeNormalDeathRate(0.5, 0.5, 0.5, config);
		const total = normal + computeFamineMortality(1, config);
		expect(total).toBeGreaterThan(0.04);
	});
});

describe('updatePopulation', () => {
	it('grows a well-fed state and shrinks a starving one', () => {
		const world = makeTinyWorld();
		const fed = world.states[0]!;
		const starving = world.states[1]!;
		// Force a severe shortage for one state.
		starving.population *= 6;

		updatePopulation(world, context());

		expect(fed.growth.population).toBeGreaterThan(0);
		expect(starving.growth.population).toBeLessThan(0);
		expect(starving.foodStress).toBeGreaterThan(0.5);
	});

	it('never produces a negative or non-finite population', () => {
		const world = makeTinyWorld();
		world.states[0]!.population = 5; // tiny
		world.states[1]!.population *= 50; // famine
		updatePopulation(world, context());
		for (const s of world.states) {
			expect(Number.isFinite(s.population)).toBe(true);
			expect(s.population).toBeGreaterThanOrEqual(1);
		}
	});

	it('keeps region populations summing to the state total', () => {
		const world = generateWorld(7);
		simulateYears(world, 40);
		const owned = new Map<string, number>();
		for (const r of world.regions) {
			if (r.ownerId) owned.set(r.ownerId, (owned.get(r.ownerId) ?? 0) + r.population);
		}
		for (const s of world.states) {
			expect(owned.get(s.id)!).toBeCloseTo(s.population, 2);
		}
	});

	it('records populationGrowth causes when history is being kept', () => {
		const world = makeTinyWorld();
		const traces = new TraceSink();
		updatePopulation(world, context({ traces }));
		const causes = traces.forState(world.states[0]!.id)?.populationGrowth ?? [];
		expect(causes.map((c) => c.factor)).toContain('births');
		expect(causes.map((c) => c.factor)).toContain('deaths');
	});
});

describe('long-run demographic behaviour', () => {
	it('reaches a Malthusian ceiling rather than exploding or collapsing', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			const before = world.states.reduce((a, s) => a + s.population, 0);
			simulateYears(world, 600, { validate: true });
			const after = world.states.reduce((a, s) => a + s.population, 0);
			expect(after / before).toBeGreaterThan(0.4);
			expect(after / before).toBeLessThan(4);
			for (const s of world.states) {
				expect(Number.isFinite(s.population)).toBe(true);
				expect(s.population).toBeGreaterThan(0);
			}
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
