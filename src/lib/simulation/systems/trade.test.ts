import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYears } from '../engine';
import { makeTinyWorld } from '../testing/tiny-world';
import { computeTfp } from './production';
import { tech } from '../testing/tech';
import { computeTradeOpenness, computeTradeScore, updateTrade } from './trade';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

const evenResources = { iron: 0.3, coal: 0.3, oil: 0.3, minerals: 0.3, genericResources: 0.3 };
const ironRich = { iron: 0.9, coal: 0.1, oil: 0.1, minerals: 0.8, genericResources: 0.3 };
const ironPoor = { iron: 0.05, coal: 0.6, oil: 0.5, minerals: 0.05, genericResources: 0.3 };

describe('computeTradeScore (MODEL.md §26)', () => {
	it('rises with proximity, average opinion and both economies’ prosperity', () => {
		const base = computeTradeScore(
			0.5,
			0.5,
			0.4,
			0,
			evenResources,
			evenResources,
			0.4,
			0.4,
			0.4,
			0.4
		);
		expect(
			computeTradeScore(0.5, 0.5, 0.9, 0, evenResources, evenResources, 0.4, 0.4, 0.4, 0.4)
		).toBeGreaterThan(base);
		expect(
			computeTradeScore(0.5, 0.5, 0.4, 0.8, evenResources, evenResources, 0.4, 0.4, 0.4, 0.4)
		).toBeGreaterThan(base);
		expect(
			computeTradeScore(0.9, 0.9, 0.4, 0, evenResources, evenResources, 0.4, 0.4, 0.4, 0.4)
		).toBeGreaterThan(base);
	});

	it('rises with resource complementarity', () => {
		const similar = computeTradeScore(
			0.6,
			0.6,
			0.5,
			0,
			evenResources,
			evenResources,
			0.4,
			0.4,
			0.4,
			0.4
		);
		const complementary = computeTradeScore(
			0.6,
			0.6,
			0.5,
			0,
			ironRich,
			ironPoor,
			0.4,
			0.4,
			0.4,
			0.4
		);
		expect(complementary).toBeGreaterThan(similar);
	});
});

describe('updateTrade', () => {
	it('grows trade between compatible states toward the sigmoid target', () => {
		const world = makeTinyWorld();
		const [a, b] = [world.states[0]!, world.states[1]!];
		a.prosperity = b.prosperity = 0.7;
		a.relations[b.id]!.opinion = b.relations[a.id]!.opinion = 0.6;
		a.relations[b.id]!.trade = b.relations[a.id]!.trade = 0.05;
		for (let i = 0; i < 100; i++) updateTrade(world, context());
		expect(a.relations[b.id]!.trade).toBeGreaterThan(0.4);
		expect(a.relations[b.id]!.trade).toBe(b.relations[a.id]!.trade); // symmetric
	});

	it('collapses trade to zero between belligerents', () => {
		const world = makeTinyWorld();
		const [a, b] = [world.states[0]!, world.states[1]!];
		a.relations[b.id]!.trade = b.relations[a.id]!.trade = 0.8;
		a.relations[b.id]!.atWar = b.relations[a.id]!.atWar = true;
		for (let i = 0; i < 60; i++) updateTrade(world, context());
		expect(a.relations[b.id]!.trade).toBeLessThan(0.01);
		expect(b.relations[a.id]!.trade).toBeLessThan(0.01);
	});

	it('sets tradeOpenness in [0, 1] from partner trade intensities', () => {
		const world = makeTinyWorld();
		updateTrade(world, context());
		for (const s of world.states) {
			expect(s.tradeOpenness).toBeGreaterThanOrEqual(0);
			expect(s.tradeOpenness).toBeLessThanOrEqual(1);
		}
	});
});

describe('computeTradeOpenness', () => {
	it('is higher for a state with stronger trade relationships', () => {
		const world = makeTinyWorld();
		const [a, b] = [world.states[0]!, world.states[1]!];
		a.relations[b.id]!.trade = 0.1;
		expect(computeTradeOpenness(a, world.states)).toBeLessThan(0.5);
		a.relations[b.id]!.trade = 0.6;
		expect(computeTradeOpenness(a, world.states)).toBeGreaterThan(0.9);
	});
});

describe('trade → output (MODEL.md §27, acceptance)', () => {
	it('raises TFP, but the bonus is capped at maxTradeProductivityBonus', () => {
		const t = tech(0.3);
		const closed = computeTfp(t, 0.4, 0.5, 0.3, 0, config);
		const open = computeTfp(t, 0.4, 0.5, 0.3, 1, config);
		const overdriven = computeTfp(t, 0.4, 0.5, 0.3, 5, config); // clamped to 1
		expect(open).toBeGreaterThan(closed);
		expect(open / closed).toBeCloseTo(1 + config.economy.maxTradeProductivityBonus, 6);
		expect(overdriven).toBe(open);
	});
});

describe('trade → relations & diffusion (acceptance)', () => {
	it('permanently-belligerent pairs never build trade, unlike peaceful ones', () => {
		const world = makeTinyWorld();
		const [a, b] = [world.states[0]!, world.states[1]!];
		a.prosperity = b.prosperity = 0.7;
		a.relations[b.id]!.opinion = b.relations[a.id]!.opinion = 0.6;
		for (let i = 0; i < 120; i++) {
			a.relations[b.id]!.atWar = b.relations[a.id]!.atWar = true;
			updateTrade(world, context());
		}
		expect(a.relations[b.id]!.trade).toBeLessThan(0.05);

		const peace = makeTinyWorld();
		const [c, d] = [peace.states[0]!, peace.states[1]!];
		c.prosperity = d.prosperity = 0.7;
		c.relations[d.id]!.opinion = d.relations[c.id]!.opinion = 0.6;
		for (let i = 0; i < 120; i++) updateTrade(peace, context());
		expect(c.relations[d.id]!.trade).toBeGreaterThan(a.relations[b.id]!.trade);
	});
});

describe('long-run trade behaviour', () => {
	it('keeps trade bounded and symmetric, with a spread across pairs', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			simulateYears(world, 1000, { validate: true });
			const values: number[] = [];
			for (const s of world.states) {
				for (const other of world.states) {
					if (other === s) continue;
					const ab = s.relations[other.id]!.trade;
					const ba = other.relations[s.id]!.trade;
					expect(ab).toBeGreaterThanOrEqual(0);
					expect(ab).toBeLessThanOrEqual(1);
					expect(ab).toBeCloseTo(ba, 9);
					values.push(ab);
				}
				expect(s.tradeOpenness).toBeGreaterThanOrEqual(0);
				expect(s.tradeOpenness).toBeLessThanOrEqual(1);
			}
			expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.1);
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
