import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { TraceSink } from '../trace';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYears } from '../engine';
import { makeTinyWorld } from '../testing/tiny-world';
import { tech } from '../testing/tech';
import { TECH_DOMAINS } from '../models/state';
import {
	computeDiffusion,
	computeDomesticInnovation,
	technologyIndex,
	updateTechnology
} from './technology';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

describe('domestic innovation (MODEL.md §23, §81)', () => {
	it('increases with research intensity', () => {
		const low = computeDomesticInnovation(0.3, 0.01, 0.5, 0.5, 1, config);
		const high = computeDomesticInnovation(0.3, 0.04, 0.5, 0.5, 1, config);
		expect(high).toBeGreaterThan(low);
	});

	it('has diminishing returns near the frontier — (1−T)^1.5', () => {
		const early = computeDomesticInnovation(0.1, 0.02, 0.5, 0.5, 1, config);
		const late = computeDomesticInnovation(0.9, 0.02, 0.5, 0.5, 1, config);
		expect(late).toBeLessThan(early);
		expect(late / early).toBeCloseTo((0.1 / 0.9) ** 1.5, 6);
	});

	it('scales linearly with domain priority', () => {
		const lo = computeDomesticInnovation(0.3, 0.02, 0.5, 0.5, 0.5, config);
		const hi = computeDomesticInnovation(0.3, 0.02, 0.5, 0.5, 1.5, config);
		expect(hi / lo).toBeCloseTo(3, 6);
	});

	it('is zero at the frontier and never negative', () => {
		expect(computeDomesticInnovation(1, 0.02, 0.9, 0.9, 1.5, config)).toBe(0);
		expect(computeDomesticInnovation(1.2, 0.02, 0.9, 0.9, 1.5, config)).toBe(0);
	});
});

describe('diffusion (MODEL.md §25, §81)', () => {
	it('requires a positive technology gap', () => {
		expect(computeDiffusion(0.5, 0.3, 0.8, 0.8, 1, config)).toBe(0);
		expect(computeDiffusion(0.5, 0.5, 0.8, 0.8, 1, config)).toBe(0);
		expect(computeDiffusion(0.3, 0.5, 0.8, 0.8, 1, config)).toBeGreaterThan(0);
	});

	it('grows with trade, openness and proximity', () => {
		const base = computeDiffusion(0.2, 0.6, 0.4, 0.4, 0.4, config);
		expect(computeDiffusion(0.2, 0.6, 0.9, 0.4, 0.4, config)).toBeGreaterThan(base);
		expect(computeDiffusion(0.2, 0.6, 0.4, 0.9, 0.4, config)).toBeGreaterThan(base);
		expect(computeDiffusion(0.2, 0.6, 0.4, 0.4, 0.9, config)).toBeGreaterThan(base);
	});
});

describe('updateTechnology', () => {
	it('advances every domain and keeps it within [0, 1]', () => {
		const world = generateWorld(7);
		const before = world.states.map((s) => ({ ...s.technology }));
		updateTechnology(world, context());
		world.states.forEach((s, i) => {
			for (const d of TECH_DOMAINS) {
				expect(s.technology[d]).toBeGreaterThanOrEqual(before[i]![d]);
				expect(s.technology[d]).toBeLessThanOrEqual(1);
			}
		});
	});

	it('caps per-domain diffusion at maxAnnualDiffusion', () => {
		// A backward state surrounded by frontier neighbours, all with max trade.
		const world = generateWorld(7);
		const target = world.states[0]!;
		for (const d of TECH_DOMAINS) target.technology[d] = 0.01;
		for (const other of world.states) {
			if (other === target) continue;
			other.technology = tech(1);
			const rel = target.relations[other.id]!;
			rel.trade = 1;
			rel.opinion = 1;
			rel.proximity = 1;
			rel.atWar = false;
		}
		target.spending.research = 0; // isolate diffusion
		const before = target.technology.energy;
		updateTechnology(world, context());
		expect(target.technology.energy - before).toBeLessThanOrEqual(
			config.technology.maxAnnualDiffusion + 1e-9
		);
		expect(target.technology.energy - before).toBeGreaterThan(0);
	});

	it('records a technologyGrowth decomposition', () => {
		const world = generateWorld(7);
		const traces = new TraceSink();
		updateTechnology(world, context({ traces }));
		const causes = traces.forState(world.states[0]!.id)?.technologyGrowth ?? [];
		expect(causes.map((c) => c.factor).sort()).toEqual(['diffusion', 'domestic_innovation']);
	});
});

describe('convergence: connected states close the gap faster than isolated ones', () => {
	function scenario(connected: boolean) {
		const world = makeTinyWorld();
		const [advanced, laggard] = [world.states[0]!, world.states[1]!];
		advanced.technology = tech(0.6);
		laggard.technology = tech(0.2);
		for (const [a, b] of [
			[advanced, laggard],
			[laggard, advanced]
		] as const) {
			const rel = a.relations[b.id]!;
			rel.trade = connected ? 0.8 : 0;
			rel.opinion = connected ? 0.6 : 0;
			rel.proximity = 1;
			rel.atWar = false;
		}
		for (let i = 0; i < 150; i++) updateTechnology(world, context());
		return technologyIndex(laggard.technology);
	}

	it('the connected laggard ends more advanced', () => {
		expect(scenario(true)).toBeGreaterThan(scenario(false));
	});
});

describe('long-run technology behaviour', () => {
	it('advances toward but not past the frontier over 1,000 years', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			simulateYears(world, 1000, { validate: true });
			for (const s of world.states) {
				if (!s.alive) continue;
				const idx = technologyIndex(s.technology);
				expect(idx).toBeGreaterThan(0.3); // it did advance
				expect(idx).toBeLessThan(0.99); // no full runaway to the frontier
			}
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
