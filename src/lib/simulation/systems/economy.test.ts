import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { TraceSink } from '../trace';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYear, simulateYears } from '../engine';
import { updateProduction } from './economy';
import { accumulateCapital, computeGdp, computeTfp } from './production';
import { tech } from '../testing/tech';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

describe('production function (MODEL.md §13–§14, §81)', () => {
	it('GDP rises with capital, all else equal', () => {
		expect(computeGdp(1, 200, 1000, 0.35)).toBeLessThan(computeGdp(1, 400, 1000, 0.35));
	});

	it('GDP rises with population (the labour input)', () => {
		expect(computeGdp(1, 300, 800, 0.35)).toBeLessThan(computeGdp(1, 300, 1600, 0.35));
	});

	it('TFP rises with institutional capacity', () => {
		const t = tech(0.3);
		expect(computeTfp(t, 0.2, 0.6, 0.3, 0.3, config)).toBeLessThan(
			computeTfp(t, 0.9, 0.6, 0.3, 0.3, config)
		);
	});

	it('TFP rises with technology, stability and infrastructure', () => {
		const base = computeTfp(tech(0.2), 0.4, 0.5, 0.2, 0.2, config);
		expect(computeTfp(tech(0.6), 0.4, 0.5, 0.2, 0.2, config)).toBeGreaterThan(base);
		expect(computeTfp(tech(0.2), 0.4, 0.9, 0.2, 0.2, config)).toBeGreaterThan(base);
		expect(computeTfp(tech(0.2), 0.4, 0.5, 0.8, 0.2, config)).toBeGreaterThan(base);
	});

	it('caps the trade productivity bonus at maxTradeProductivityBonus', () => {
		const noTrade = computeTfp(tech(0.3), 0.4, 0.5, 0.3, 0, config);
		const fullTrade = computeTfp(tech(0.3), 0.4, 0.5, 0.3, 1, config);
		expect(fullTrade / noTrade).toBeCloseTo(1 + config.economy.maxTradeProductivityBonus, 6);
	});
});

describe('capital accumulation (MODEL.md §15, §81)', () => {
	it('war damage reduces next-year capital', () => {
		const peace = accumulateCapital(1000, 500, 20, 0, config);
		const war = accumulateCapital(1000, 500, 20, 80, config);
		expect(war).toBeLessThan(peace);
		expect(war).toBe(peace - 80);
	});

	it('never returns a negative capital stock', () => {
		expect(accumulateCapital(10, 0, 0, 1000, config)).toBe(0);
	});

	it('investment and depreciation move toward a steady state', () => {
		let k = 50;
		for (let i = 0; i < 400; i++) k = accumulateCapital(k, 100, 0, 0, config);
		// s·Y = δ·K  ⇒  K* = (s/δ)·Y = 4.5·100
		expect(k).toBeCloseTo(
			(config.economy.privateInvestmentRate / config.economy.capitalDepreciation) * 100,
			1
		);
	});
});

describe('updateProduction', () => {
	it('sets productivity, GDP, GDP per capita and prosperity for every state', () => {
		const world = generateWorld(7);
		for (const s of world.states) s.gdp = 0;
		updateProduction(world, context());
		for (const s of world.states) {
			expect(s.gdp).toBeGreaterThan(0);
			expect(s.gdpPerCapita).toBeGreaterThan(0);
			expect(s.prosperity).toBeGreaterThan(0);
			expect(s.prosperity).toBeLessThan(1);
			expect(s.productivity).toBeGreaterThan(0);
		}
	});

	it('a larger population yields a larger GDP the same year', () => {
		const world = generateWorld(7);
		const a = world.states[0]!;
		updateProduction(world, context());
		const gdpBefore = a.gdp;
		a.population *= 1.5;
		updateProduction(world, context());
		expect(a.gdp).toBeGreaterThan(gdpBefore);
	});

	it('records a gdpGrowth decomposition that sums to the growth rate', () => {
		const world = generateWorld(7);
		simulateYear(world); // establish a previous year
		const traces = new TraceSink();
		updateProduction(world, context({ traces }));
		const a = world.states[0]!;
		const causes = traces.forState(a.id)?.gdpGrowth ?? [];
		expect(causes.map((c) => c.factor).sort()).toEqual([
			'capital_investment',
			'population',
			'productivity'
		]);
		const sum = causes.reduce((acc, c) => acc + c.impact, 0);
		expect(sum).toBeCloseTo(a.growth.gdp, 9);
	});
});

describe('long-run economic behaviour', () => {
	it('GDP grows toward a bounded steady state without exploding', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			const startPerCapita = world.states.map((s) => s.gdpPerCapita);
			simulateYears(world, 800, { validate: true });
			world.states.forEach((s, i) => {
				expect(Number.isFinite(s.gdp)).toBe(true);
				expect(s.gdpPerCapita).toBeGreaterThan(startPerCapita[i]! * 0.8);
				// capital settles near (s/δ)·GDP — bounded, not runaway
				expect(s.capital / s.gdp).toBeGreaterThan(2);
				expect(s.capital / s.gdp).toBeLessThan(12);
			});
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
