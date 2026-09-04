import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYears } from '../engine';
import { accumulateMilitaryCapital, computeMilitaryPower, updateMilitary } from './military';
import { computeStress } from './politics';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

describe('accumulateMilitaryCapital (MODEL.md §41)', () => {
	it('converges to investment / depreciation', () => {
		let k = 0;
		for (let i = 0; i < 500; i++) k = accumulateMilitaryCapital(k, 100, 0, config);
		expect(k).toBeCloseTo(100 / config.military.depreciation, 1);
	});

	it('war losses reduce it and it never goes negative', () => {
		expect(accumulateMilitaryCapital(1000, 50, 200, config)).toBeLessThan(
			accumulateMilitaryCapital(1000, 50, 0, config)
		);
		expect(accumulateMilitaryCapital(10, 0, 1e9, config)).toBe(0);
	});
});

describe('computeMilitaryPower (MODEL.md §42)', () => {
	it('rises with capital, population, military tech, transport, infrastructure and stability', () => {
		const base = computeMilitaryPower(1e6, 1e6, 0.3, 0.3, 0.3, 0.5);
		expect(computeMilitaryPower(4e6, 1e6, 0.3, 0.3, 0.3, 0.5)).toBeGreaterThan(base);
		expect(computeMilitaryPower(1e6, 4e6, 0.3, 0.3, 0.3, 0.5)).toBeGreaterThan(base);
		expect(computeMilitaryPower(1e6, 1e6, 0.9, 0.3, 0.3, 0.5)).toBeGreaterThan(base);
		expect(computeMilitaryPower(1e6, 1e6, 0.3, 0.9, 0.3, 0.5)).toBeGreaterThan(base);
		expect(computeMilitaryPower(1e6, 1e6, 0.3, 0.3, 0.9, 0.5)).toBeGreaterThan(base);
		expect(computeMilitaryPower(1e6, 1e6, 0.3, 0.3, 0.3, 0.95)).toBeGreaterThan(base);
	});

	it('scales with the square root of capital', () => {
		const p1 = computeMilitaryPower(1e6, 1e6, 0.3, 0.3, 0.3, 0.5);
		const p2 = computeMilitaryPower(4e6, 1e6, 0.3, 0.3, 0.3, 0.5);
		expect(p2 / p1).toBeCloseTo(2, 6);
	});
});

describe('updateMilitary', () => {
	it('sets a finite positive power and burden for every state', () => {
		const world = generateWorld(7);
		updateMilitary(world, context());
		for (const s of world.states) {
			expect(s.military.power).toBeGreaterThan(0);
			expect(Number.isFinite(s.military.power)).toBe(true);
			expect(s.military.burden).toBeCloseTo(s.spending.military / s.gdp, 9);
		}
	});
});

describe('military burden → stability (MODEL.md §43)', () => {
	it('burden above ~8% of GDP adds political stress', () => {
		const withinBudget = computeStress(0.3, 0.3, 0, 0, 0, 0.2, 0); // burden ≤ 8%
		const overBurdened = computeStress(0.3, 0.3, 0, 0, 0, 0.2, 0.8); // burden ≫ 8%
		expect(overBurdened).toBeGreaterThan(withinBudget);
	});

	it('a heavily militarized state ends less stable than a lightly armed twin', () => {
		const heavy = generateWorld(7);
		const light = generateWorld(7);
		for (const s of heavy.states) {
			s.budget = {
				infrastructure: 0.12,
				education: 0.08,
				research: 0.03,
				military: 0.55,
				welfare: 0.1,
				administration: 0.12
			};
		}
		for (const s of light.states) {
			s.budget = {
				infrastructure: 0.25,
				education: 0.2,
				research: 0.1,
				military: 0.05,
				welfare: 0.2,
				administration: 0.2
			};
		}
		simulateYears(heavy, 250);
		simulateYears(light, 250);
		const mean = (w: typeof heavy, f: (s: (typeof heavy)['states'][number]) => number) =>
			w.states.reduce((a, s) => a + f(s), 0) / w.states.length;
		// more military power…
		expect(mean(heavy, (s) => s.military.power)).toBeGreaterThan(
			mean(light, (s) => s.military.power)
		);
		// …but weaker economy and stability
		expect(mean(heavy, (s) => s.gdpPerCapita)).toBeLessThan(mean(light, (s) => s.gdpPerCapita));
		expect(mean(heavy, (s) => s.politics.stability)).toBeLessThan(
			mean(light, (s) => s.politics.stability)
		);
	});
});

describe('dynamic power feeds threat perception (MODEL.md §48)', () => {
	it('a state that arms up is perceived as more threatening by its neighbours', () => {
		const control = generateWorld(7);
		const arming = generateWorld(7);
		for (const s of arming.states) {
			if (s.id === arming.states[0]!.id) {
				s.budget = { ...s.budget, military: 0.6, infrastructure: 0.1, education: 0.05 };
			}
		}
		simulateYears(control, 150);
		simulateYears(arming, 150);
		const threatToState0 = (w: typeof control) =>
			w.states
				.slice(1)
				.reduce((a, s) => a + (s.relations[w.states[0]!.id]?.threatPerception ?? 0), 0) /
			(w.states.length - 1);
		expect(threatToState0(arming)).toBeGreaterThan(threatToState0(control));
	});
});

describe('long-run military behaviour', () => {
	it('keeps military capital and power finite and bounded over 1,000 years', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			simulateYears(world, 1000, { validate: true });
			for (const s of world.states) {
				expect(s.military.capital).toBeGreaterThanOrEqual(0);
				expect(Number.isFinite(s.military.capital)).toBe(true);
				expect(s.military.power).toBeGreaterThan(0);
				expect(Number.isFinite(s.military.power)).toBe(true);
			}
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
